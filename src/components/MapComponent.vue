<template>
  <div id="map" class="leaflet-map"></div>

  <!-- Индикатор загрузки -->
  <div v-if="isLoading" class="loading-indicator">
    <div class="spinner"></div>
    <div class="loading-text">Загрузка...</div>
  </div>

  <!-- Бургер-меню (мобильные) -->
  <button v-if="isMobile" class="burger-btn" @click="burgerOpen = !burgerOpen">
    ☰
  </button>

  <!-- Кнопка переключения режима (десктоп) -->
  <button
    v-if="!isMobile"
    class="mode-btn"
    :class="{ active: editMode }"
    @click="toggleMode"
  >
    {{ editMode ? "🏹 Расставляем" : "👁️ Смотрим" }}
  </button>

  <!-- Переключатель слоёв (десктоп) -->
  <div v-if="!isMobile" class="layer-switch">
    <button :class="{ active: activeLayer === 'game' }" @click="setActiveLayer('game')">
      Дичь
    </button>
    <button :class="{ active: activeLayer === 'alchemy' }" @click="setActiveLayer('alchemy')">
      Растения
    </button>
    <button :class="{ active: activeLayer === 'both' }" @click="setActiveLayer('both')">
      Оба
    </button>
  </div>

  <!-- Основная панель (только фильтры) -->
  <div
    class="panel"
    :class="{
      'panel-mobile': isMobile,
      'panel-mobile-open': burgerOpen,
      'panel-view': !editMode && !isMobile,
    }"
  >
    <div class="panel-header">
<!-- Переключатель слоёв для мобильных устройств -->
<div v-if="isMobile" class="section">
  <div class="section-title">🗺️ РЕЖИМ КАРТЫ</div>
  <div class="layer-switch-mobile">
    <button :class="{ active: activeLayer === 'game' }" @click="setActiveLayer('game')">
      Дичь
    </button>
    <button :class="{ active: activeLayer === 'alchemy' }" @click="setActiveLayer('alchemy')">
      Растения
    </button>
    <button :class="{ active: activeLayer === 'both' }" @click="setActiveLayer('both')">
      Оба
    </button>
  </div>
</div>
    </div>

    <!-- Фильтры дичи -->
    <div v-if="activeLayer === 'game' || activeLayer === 'both'" class="section">
      <div class="section-title">⚔️ ФИЛЬТР (ДИЧЬ)</div>
      <div class="filter-grid">
        <label
          v-for="type in markerTypes"
          :key="type.id"
          class="filter-item"
          :class="{ active: activeFilters.includes(type.id) }"
        >
          <input type="checkbox" :value="type.id" v-model="activeFilters" @change="applyFilters" />
          <img :src="type.icon" :alt="type.name" />
          <span>{{ type.name }}</span>
        </label>
      </div>
      <div class="filter-btns">
        <button @click="selectAllFilters">ВСЕ</button>
        <button @click="clearAllFilters">НИЧЕГО</button>
      </div>
    </div>

    <!-- Фильтры алхимии -->
    <div v-if="(activeLayer === 'alchemy' || activeLayer === 'both') && alchemyLayerRef" class="section">
      <div class="section-title">🌿 ФИЛЬТР (РАСТЕНИЯ)</div>
      <div class="filter-grid">
        <label
          v-for="type in alchemyLayerRef.alchemyTypes"
          :key="type.id"
          class="filter-item"
          :class="{ active: alchemyLayerRef.activeFilters.includes(type.id) }"
        >
          <input
            type="checkbox"
            :value="type.id"
            v-model="alchemyLayerRef.activeFilters"
            @change="alchemyLayerRef.applyFilters()"
          />
          <img :src="type.icon" :alt="type.name" />
          <span>{{ type.name }}</span>
        </label>
      </div>
      <div class="filter-btns">
        <button @click="selectAllAlchemyFilters">ВСЕ</button>
        <button @click="clearAllAlchemyFilters">НИЧЕГО</button>
      </div>
    </div>

    <div class="panel-footer">
      <div class="footer-ornament">— ◆ —</div>
      Данные синхронизируются с Google Таблицей<br />
      <strong>Багрепорт в Discord:</strong><br />
      <a href="https://discord.com/users/mashrooooooooms" target="_blank">
        mashrooooooooms
      </a>
    </div>
  </div>

  <transition name="fade">
    <div class="toast" v-if="toastMsg">{{ toastMsg }}</div>
  </transition>

  <!-- Модальное окно добавления -->
  <AddMarkerModal
    :visible="showModal"
    :coords="modalCoords"
    :layer-mode="activeLayer"
    :game-types="markerTypes"
    :alchemy-types="alchemyLayerRef?.alchemyTypes || []"
    @close="closeModal"
    @save-game="handleSaveGameMarker"
    @save-alchemy="handleSaveAlchemyMarker"
  />

  <!-- Компонент алхимического слоя -->
  <AlchemyLayer
    ref="alchemyLayerRef"
    :map="mapInstance"
    :active="activeLayer === 'alchemy' || activeLayer === 'both'"
    :edit-mode="editMode && !isMobile"
    @toast="handleAlchemyToast"
  />
</template>

<script setup>
import { onMounted, ref, nextTick, onBeforeUnmount } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AlchemyLayer from "./AlchemyLayer.vue";
import AddMarkerModal from "./AddMarkerModal.vue";

const BASE = import.meta.env.BASE_URL;
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzYoW5mKzznhmrygbOC9g8bITiNKQWRTaGKVSqJ8n4PLdYe2wqB47S656fTK_xIieLYJA/exec";

const markerTypes = [
  { id: "elk", name: "Олень", icon: BASE + "elk.png" },
  { id: "wolf", name: "Волк", icon: BASE + "wolf.png" },
  { id: "rat", name: "Крыса", icon: BASE + "rat.png" },
  { id: "bear", name: "Медведь", icon: BASE + "bear.png" },
  { id: "troll", name: "Тролль", icon: BASE + "troll.png" },
  { id: "sabertooth", name: "Саблезуб", icon: BASE + "cat.png" },
  { id: "spider", name: "Паук", icon: BASE + "spider.png" },
  { id: "scorpio", name: "Корус", icon: BASE + "scorpio.png" },
  { id: "snake", name: "Змея", icon: BASE + "snake.png" },
  { id: "eleph", name: "Мамонт", icon: BASE + "eleph.png" },
  { id: "gig", name: "Великан", icon: BASE + "gig.png" },
  { id: "bird", name: "Фазан", icon: BASE + "bird.png" },
];

const editMode = ref(false);
const toastMsg = ref("");
const activeFilters = ref(markerTypes.map((t) => t.id));
const isLoading = ref(false);
const isMobile = ref(false);
const burgerOpen = ref(false);
const activeLayer = ref("game");

const allMarkers = ref([]);
let mapInstance = null;
let updateInterval = null;
let leafletMarkers = [];

const alchemyLayerRef = ref(null);

// Модалка
const showModal = ref(false);
const modalCoords = ref(null);

function handleResize() {
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  const isNarrowScreen = window.innerWidth <= 1024;
  isMobile.value = isTouchDevice || isNarrowScreen;
  if (isMobile.value) editMode.value = false;
}

function toast(msg) {
  toastMsg.value = msg;
  setTimeout(() => (toastMsg.value = ""), 2000);
}

function handleAlchemyToast(msg) {
  toast(msg);
}

// ========== ДИЧЬ ==========
function getTypeIcon(typeId) {
  return markerTypes.find((t) => t.id === typeId)?.icon || BASE + "elk.png";
}

function createLeafletIcon(typeId) {
  return L.divIcon({
    className: "",
    html: `<div class="map-marker"><img src="${getTypeIcon(typeId)}" alt="" /></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

async function loadMarkers() {
  isLoading.value = true;
  try {
    const res = await fetch(WEB_APP_URL);
    const text = await res.text();
    const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      toast("❌ Сервер вернул не JSON");
      return;
    }
    if (data?.error) throw new Error(data.error);
    if (!Array.isArray(data)) throw new Error("Неверный формат");
    allMarkers.value = data;
    refreshMapMarkers();
  } catch (err) {
    toast(`❌ Ошибка загрузки дичи: ${err.message}`);
  } finally {
    isLoading.value = false;
  }
}

async function addMarkerToSheet(marker) {
  const formData = new FormData();
  formData.append("coords", marker.coords);
  formData.append("type", marker.type);
  formData.append("title", marker.title);
  formData.append("description", marker.description);
  const res = await fetch(WEB_APP_URL, { method: "POST", body: formData });
  const text = await res.text();
  const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const json = JSON.parse(cleanText);
  if (json.error) throw new Error(json.error);
  return json;
}

function refreshMapMarkers() {
  leafletMarkers.forEach((item) => {
    if (mapInstance?.hasLayer(item.marker)) mapInstance.removeLayer(item.marker);
  });
  leafletMarkers.length = 0;

  allMarkers.value.forEach((m) => {
    let coordsArray = JSON.parse(m.coords);
    const marker = L.marker(coordsArray, { icon: createLeafletIcon(m.type) }).bindTooltip(
      `<b>${m.title}</b><br><span>${m.description}</span>`,
      { direction: "top", offset: [0, -20], className: "custom-tooltip" }
    );
    leafletMarkers.push({ marker, type: m.type, id: m.id });
    if (activeFilters.value.includes(m.type) && (activeLayer.value === "game" || activeLayer.value === "both")) {
      marker.addTo(mapInstance);
    }
  });
}

function applyFilters() {
  leafletMarkers.forEach(({ marker, type }) => {
    const shouldShow = (activeLayer.value === "game" || activeLayer.value === "both") && activeFilters.value.includes(type);
    if (shouldShow && !mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
    if (!shouldShow && mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
  });
}

function selectAllFilters() {
  activeFilters.value = markerTypes.map((t) => t.id);
  applyFilters();
}
function clearAllFilters() {
  activeFilters.value = [];
  applyFilters();
}
function selectAllAlchemyFilters() {
  if (alchemyLayerRef.value) {
    alchemyLayerRef.value.activeFilters = alchemyLayerRef.value.alchemyTypes.map((t) => t.id);
    alchemyLayerRef.value.applyFilters();
  }
}
function clearAllAlchemyFilters() {
  if (alchemyLayerRef.value) {
    alchemyLayerRef.value.activeFilters = [];
    alchemyLayerRef.value.applyFilters();
  }
}

// Сохранение дичи из модалки
async function handleSaveGameMarker(markerData) {
  try {
    await addMarkerToSheet(markerData);
    await loadMarkers();
    toast(`✅ Добавлен: ${markerData.title}`);
  } catch (err) {
    toast(`❌ Ошибка: ${err.message}`);
  }
}

// Сохранение алхимии из модалки
async function handleSaveAlchemyMarker(markerData) {
  if (alchemyLayerRef.value) {
    await alchemyLayerRef.value.addMarkerDirect(markerData);
    await alchemyLayerRef.value.loadMarkers();
    toast(`✅ Добавлен алхимический ресурс: ${markerData.title}`);
  }
}

function closeModal() {
  showModal.value = false;
  modalCoords.value = null;
}

// ========== УПРАВЛЕНИЕ ==========
function setActiveLayer(layer) {
  activeLayer.value = layer;
  applyFilters();
  if (alchemyLayerRef.value) alchemyLayerRef.value.applyFilters();
}

function toggleMode() {
  if (isMobile.value) return;
  editMode.value = !editMode.value;
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = editMode.value ? "crosshair" : "";
  }
}

// Обработчик клика по карте – открывает модалку
function onMapClick(e) {
  if (!editMode.value || isMobile.value) return;
  const lat = Math.round(e.latlng.lat);
  const lng = Math.round(e.latlng.lng);
  modalCoords.value = { lat, lng };
  showModal.value = true;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
onMounted(() => {
  window.addEventListener("resize", handleResize);
  handleResize();

  const img = new Image();
  img.src = BASE + "5171-0-1480272622.webp";
  img.onload = () => {
    const boundsH = 1000;
    const boundsW = (img.naturalWidth / img.naturalHeight) * boundsH;
    const imageBounds = [
      [0, 0],
      [boundsH, boundsW],
    ];

    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -10,
      maxZoom: 10,
      zoomSnap: 0.25,
      attributionControl: false,
    });
    mapInstance = map;
    L.imageOverlay(BASE + "5171-0-1480272622.webp", imageBounds).addTo(map);
    map.fitBounds(imageBounds);

    map.on("click", onMapClick);

    loadMarkers();
    if (alchemyLayerRef.value) alchemyLayerRef.value.loadMarkers();

    updateInterval = setInterval(() => {
      loadMarkers();
      if (alchemyLayerRef.value) alchemyLayerRef.value.loadMarkers();
    }, 30000);
  };
});

onBeforeUnmount(() => {
  if (updateInterval) clearInterval(updateInterval);
  window.removeEventListener("resize", handleResize);
  if (mapInstance) mapInstance.remove();
});
</script>

<style scoped>
/* Все ваши существующие стили остаются без изменений */
/* ... (скопируйте свои стили из исходного файла) ... */
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital@0;1&display=swap");

.leaflet-map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
}

.loading-indicator {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 12px;
  border-radius: 8px;
  font-family: "Cinzel", serif;
  backdrop-filter: blur(4px);
  border: 1px solid #8b7355;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e8dcc8;
  border-top: 2px solid #8b2500;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.loading-text {
  color: #e8dcc8;
  font-size: 12px;
}

.mode-btn {
  position: fixed;
  top: 16px;
  left: 60px;
  z-index: 1000;
  padding: 10px 18px;
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  border: 2px solid #8b7355;
  border-radius: 4px;
  font: bold 12px "Cinzel", serif;
  cursor: pointer;
}
.mode-btn.active {
  background: linear-gradient(135deg, #8b2500, #6b1c00);
  border-color: #c4713b;
}

.layer-switch {
  position: fixed;
  top: 16px;
  left: 220px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 12px;
  border-radius: 40px;
  backdrop-filter: blur(4px);
  border: 1px solid #8b7355;
}
.layer-switch button {
  background: #3e2f23;
  border: none;
  color: #e8dcc8;
  padding: 6px 14px;
  border-radius: 30px;
  font: bold 11px "Cinzel", serif;
  cursor: pointer;
}
.layer-switch button.active {
  background: #8b2500;
}

.burger-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1002;
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  border: 2px solid #8b7355;
  color: #e8dcc8;
  font-size: 24px;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  cursor: pointer;
}

.panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 999;
  width: 280px;
  height: 100vh;
  background: linear-gradient(180deg, #f5efe6, #e8dcc8, #ddd0b8);
  color: #3e2f23;
  border-left: 3px solid #8b7355;
  padding: 16px;
  overflow-y: auto;
  font-family: "Crimson Text", serif;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease;
}
.panel-view {
  width: 220px;
}
.panel-mobile {
  width: 280px;
  transform: translateX(100%);
}
.panel-mobile-open {
  transform: translateX(0);
}
.close-burger {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  margin-left: auto;
  color: #8b2500;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 2px solid #8b7355;
}
.panel-title {
  font: bold 16px "Cinzel", serif;
}

.section {
  margin-bottom: 18px;
}
.section-title {
  font: bold 11px "Cinzel", serif;
  letter-spacing: 3px;
  color: #6d5a48;
  border-bottom: 1px solid #c4a87a;
  padding-bottom: 6px;
  margin-bottom: 10px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(139, 115, 85, 0.08);
  border: 1px solid #c4a87a;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.45;
}
.filter-item.active {
  background: rgba(139, 115, 85, 0.25);
  border-color: #8b7355;
  opacity: 1;
}
.filter-item input {
  display: none;
}
.filter-item img {
  width: 20px;
  height: 20px;
}
.filter-btns {
  display: flex;
  gap: 6px;
}
.filter-btns button {
  flex: 1;
  padding: 6px;
  background: rgba(139, 115, 85, 0.1);
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: bold 9px "Cinzel", serif;
  cursor: pointer;
}
.panel-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 2px solid #8b7355;
  font-size: 12px;
  text-align: center;
}
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  padding: 10px 24px;
  border-radius: 4px;
  font: bold 12px "Cinzel", serif;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (orientation: landscape) and (max-width: 768px) {
  .panel-mobile {
    width: 280px;
  }
  .burger-btn {
    top: 8px;
    right: 8px;
  }
  .loading-indicator {
    top: 8px;
    right: 8px;
  }
}
</style>

<style>
/* Глобальные стили для маркеров */
.map-marker {
  width: 36px;
  height: 36px;
  background: radial-gradient(circle, #c0392b, #8b2500);
  border: 3px solid #e8dcc8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(139, 37, 0, 0.5), 0 0 0 2px rgba(139, 37, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s;
}
.map-marker:hover {
  transform: scale(1.2);
}
.map-marker img {
  width: 20px;
  height: 20px;
  filter: brightness(10);
}

.map-marker-alchemy {
  width: 36px;
  height: 36px;
  background: radial-gradient(circle, #2c6e9e, #1a3f5c);
  color: white;
  border: 3px solid #e8dcc8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(28, 78, 128, 0.5), 0 0 0 2px rgba(28, 78, 128, 0.3);
  cursor: pointer;
  transition: transform 0.15s;
}
.map-marker-alchemy:hover {
  transform: scale(1.2);
}
.map-marker-alchemy img {
  width: 20px;
  height: 20px;
  filter: brightness(0) invert(1);
}

.custom-tooltip {
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  border: 1px solid #8b7355;
  border-radius: 4px;
  padding: 8px 14px;
  font-family: "Crimson Text", serif;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.custom-tooltip b {
  display: block;
  margin-bottom: 3px;
  font-family: "Cinzel", serif;
  font-size: 12px;
  color: #ffeedd;
}
.custom-tooltip span {
  color: #c4a87a;
  font-style: italic;
}
.leaflet-tooltip-top:before {
  border-top-color: #3e2f23;
}

.layer-switch-mobile {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.layer-switch-mobile button {
  flex: 1;
  background: #3e2f23;
  border: 1px solid #c4a87a;
  color: #e8dcc8;
  padding: 8px;
  border-radius: 30px;
  font: bold 11px "Cinzel", serif;
  cursor: pointer;
}
.layer-switch-mobile button.active {
  background: #8b2500;
}
</style>