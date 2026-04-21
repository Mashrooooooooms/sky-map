<template>
  <div id="map" class="leaflet-map"></div>

  <!-- Индикатор загрузки (правый верхний угол) -->
  <div v-if="isLoading" class="loading-indicator">
    <div class="spinner"></div>
    <div class="loading-text">Загрузка...</div>
  </div>

  <!-- Бургер-меню для фильтров (только на мобильных) -->
  <button v-if="isMobile" class="burger-btn" @click="burgerOpen = !burgerOpen">
    ☰
  </button>

  <!-- Кнопка переключения режима (только на десктопе) -->
  <button
    v-if="!isMobile"
    class="mode-btn"
    :class="{ active: editMode }"
    @click="toggleMode"
  >
    {{ editMode ? "🏹 Расставляем" : "👁️ Смотрим" }}
  </button>

  <!-- Основная панель (на десктопе всегда справа, на мобильных - выезжающий бургер) -->
  <div
    class="panel"
    :class="{
      'panel-mobile': isMobile,
      'panel-mobile-open': burgerOpen,
      'panel-view': !editMode && !isMobile,
    }"
  >
    <div class="panel-header">
      <span class="panel-logo">🗺️</span>
      <span class="panel-title">Карта дичи</span>
      <button v-if="isMobile" class="close-burger" @click="burgerOpen = false">
        ✕
      </button>
    </div>

    <!-- Фильтры (всегда в панели) -->
    <div class="section">
      <div class="section-title">⚔️ ФИЛЬТР</div>
      <div class="filter-grid">
        <label
          v-for="type in markerTypes"
          :key="type.id"
          class="filter-item"
          :class="{ active: activeFilters.includes(type.id) }"
        >
          <input
            type="checkbox"
            :value="type.id"
            v-model="activeFilters"
            @change="applyFilters"
          />
          <img :src="type.icon" :alt="type.name" />
          <span>{{ type.name }}</span>
        </label>
      </div>
      <div class="filter-btns">
        <button @click="selectAllFilters">ВСЕ</button>
        <button @click="clearAllFilters">НИЧЕГО</button>
      </div>
    </div>

    <!-- Блок добавления маркера (только на десктопе и в режиме редактирования) -->
    <template v-if="!isMobile && editMode">
      <div class="section">
        <div class="section-title">📍 НОВЫЙ МАРКЕР</div>

        <template v-if="pendingCoords">
          <div class="coords-line">{{ pendingCoords }}</div>

          <div class="type-label">Тип добычи</div>
          <div class="type-grid">
            <button
              v-for="type in markerTypes"
              :key="type.id"
              class="type-btn"
              :class="{ selected: selectedType === type.id }"
              @click="selectedType = type.id"
              :title="type.name"
            >
              <img :src="type.icon" :alt="type.name" />
            </button>
          </div>

          <input
            v-model="formTitle"
            placeholder="Название места"
            ref="titleInput"
            @keyup.enter="saveMarker"
          />
          <input
            v-model="formDescription"
            placeholder="Что здесь водится..."
            @keyup.enter="saveMarker"
          />
          <div class="form-btns">
            <button class="btn-add" @click="saveMarker">🏹 ДОБАВИТЬ</button>
            <button class="btn-cancel" @click="cancelMarker">ОТМЕНА</button>
          </div>
        </template>

        <template v-else>
          <div class="hint">Кликните по карте, чтобы отметить место</div>
        </template>
      </div>
    </template>

    <!-- Список всех маркеров (показывается только в режиме редактирования на десктопе, на мобильных всегда) -->

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
</template>

<script setup>
import { onMounted, ref, nextTick, onBeforeUnmount } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE = import.meta.env.BASE_URL;
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzYoW5mKzznhmrygbOC9g8bITiNKQWRTaGKVSqJ8n4PLdYe2wqB47S656fTK_xIieLYJA/exec";

const markerTypes = [
  { id: "elk", name: "Олень", icon: BASE + "elk.png" },
  { id: "wolf", name: "Волк", icon: BASE + "wolf.png" },
  { id: "rat", name: "Крыса", icon: BASE + "rat.png" },
  { id: "bear", name: "Медведь", icon: BASE + "bear.png" },
  { id: "troll", name: "Тролль", icon: BASE + "troll.png" },
  { id: "spider", name: "Паук", icon: BASE + "spider.png" },
  { id: "scorpio", name: "Корус", icon: BASE + "scorpio.png" },
  { id: "snake", name: "Змея", icon: BASE + "snake.png" },
  { id: "eleph", name: "Мамонт", icon: BASE + "eleph.png" },
  { id: "gig", name: "Великан", icon: BASE + "gig.png" },
];

// Реактивные переменные
const editMode = ref(false);
const formTitle = ref("");
const formDescription = ref("");
const pendingCoords = ref("");
const selectedType = ref("elk");
const titleInput = ref(null);
const toastMsg = ref("");
const activeFilters = ref(markerTypes.map((t) => t.id));
const isLoading = ref(false);
const isMobile = ref(false);
const burgerOpen = ref(false);

let pendingLatLng = null;
let mapInstance = null;
let updateInterval = null;

const allMarkers = ref([]);
const leafletMarkers = [];

// Определение мобильного режима с учётом сенсорного ввода и ширины экрана
function handleResize() {
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  const isNarrowScreen = window.innerWidth <= 1024;
  isMobile.value = isTouchDevice || isNarrowScreen;

  if (isMobile.value) {
    editMode.value = false; // на мобильных всегда просмотр
    if (mapInstance) mapInstance.getContainer().style.cursor = "";
  }
}

function getTypeIcon(typeId) {
  return markerTypes.find((t) => t.id === typeId)?.icon || BASE + "elk.png";
}

function createLeafletIcon(typeId) {
  return L.divIcon({
    className: "",
    html: `<div class="map-marker"><img src="${getTypeIcon(
      typeId
    )}" alt="" /></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createTooltipContent(title, description) {
  if (description) return `<b>${title}</b><br><span>${description}</span>`;
  return `<b>${title}</b>`;
}

// ---------- РАБОТА С СЕРВЕРОМ ----------
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
      console.error(
        "Ответ не JSON, первые 100 символов:",
        cleanText.substring(0, 100)
      );
      toast("❌ Сервер вернул не JSON (проверьте скрипт)");
      return;
    }
    if (data && data.error) {
      toast(`❌ Ошибка сервера: ${data.error}`);
      return;
    }
    if (!Array.isArray(data)) {
      toast("❌ Неверный формат данных");
      return;
    }
    allMarkers.value = data;
    refreshMapMarkers();
  } catch (err) {
    console.error(err);
    toast("❌ Ошибка загрузки данных");
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

  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    body: formData,
  });
  const text = await res.text();
  const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let json;
  try {
    json = JSON.parse(cleanText);
  } catch (e) {
    throw new Error(`Сервер ответил не JSON: ${cleanText.substring(0, 100)}`);
  }
  if (json.error) throw new Error(json.error);
  return json;
}

async function deleteMarkerFromSheet(id) {
  const formData = new FormData();
  formData.append("id", id);
  formData.append("_method", "DELETE");

  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    body: formData,
  });
  const text = await res.text();
  const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let json;
  try {
    json = JSON.parse(cleanText);
  } catch (e) {
    throw new Error(`Сервер ответил не JSON: ${cleanText.substring(0, 100)}`);
  }
  if (json.error) throw new Error(json.error);
  return json;
}

// ---------- КАРТА ----------
function refreshMapMarkers() {
  leafletMarkers.forEach((item) => {
    if (mapInstance && mapInstance.hasLayer(item.marker))
      mapInstance.removeLayer(item.marker);
  });
  leafletMarkers.length = 0;

  allMarkers.value.forEach((m) => {
    let coordsArray;
    try {
      coordsArray =
        typeof m.coords === "string" ? JSON.parse(m.coords) : m.coords;
    } catch (e) {
      console.warn("Ошибка парсинга координат:", m.coords);
      return;
    }
    const marker = L.marker(coordsArray, {
      icon: createLeafletIcon(m.type),
    }).bindTooltip(createTooltipContent(m.title, m.description), {
      direction: "top",
      offset: [0, -20],
      className: "custom-tooltip",
    });
    leafletMarkers.push({ marker, type: m.type, id: m.id });
    if (activeFilters.value.includes(m.type)) {
      marker.addTo(mapInstance);
    }
  });
}

function applyFilters() {
  leafletMarkers.forEach(({ marker, type }) => {
    if (activeFilters.value.includes(type)) {
      if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
    } else {
      if (mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
    }
  });
}

// ---------- ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ ----------
async function saveMarker() {
  if (!pendingLatLng) return;
  const title =
    formTitle.value.trim() || `Точка ${allMarkers.value.length + 1}`;
  const description = formDescription.value.trim() || "";
  const type = selectedType.value;
  const coordsStr = `[${Math.round(pendingLatLng.lat)}, ${Math.round(
    pendingLatLng.lng
  )}]`;

  try {
    await addMarkerToSheet({ coords: coordsStr, type, title, description });
    await loadMarkers(); // обновляем данные после добавления
    toast(`✅ Добавлен: ${title}`);
    cancelMarker();
  } catch (err) {
    console.error(err);
    toast(`❌ Ошибка: ${err.message}`);
  }
}

async function removeMarker(id) {
  try {
    await deleteMarkerFromSheet(id);
    await loadMarkers(); // обновляем данные после удаления
    toast("🗑️ Маркер удалён");
  } catch (err) {
    console.error(err);
    toast(`❌ Ошибка: ${err.message}`);
  }
}

function cancelMarker() {
  pendingCoords.value = "";
  pendingLatLng = null;
  formTitle.value = "";
  formDescription.value = "";
}

function toggleMode() {
  if (isMobile.value) return; // на мобильных недоступно
  editMode.value = !editMode.value;
  cancelMarker();
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = editMode.value ? "crosshair" : "";
  }
}

function selectAllFilters() {
  activeFilters.value = markerTypes.map((t) => t.id);
  applyFilters();
}

function clearAllFilters() {
  activeFilters.value = [];
  applyFilters();
}

function toast(msg) {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = "";
  }, 2000);
}

// ---------- ИНИЦИАЛИЗАЦИЯ КАРТЫ ----------
onMounted(() => {
  window.addEventListener("resize", handleResize);
  handleResize(); // сразу установим правильный флаг мобильности

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

    map.on("click", (e) => {
      if (!editMode.value || isMobile.value) return;
      const lat = Math.round(e.latlng.lat);
      const lng = Math.round(e.latlng.lng);
      pendingCoords.value = `[${lat}, ${lng}]`;
      pendingLatLng = e.latlng;
      formTitle.value = "";
      formDescription.value = "";
      selectedType.value = "elk";
      nextTick(() => titleInput.value?.focus());
    });

    loadMarkers();
    updateInterval = setInterval(loadMarkers, 30000);
  };
});

onBeforeUnmount(() => {
  if (updateInterval) clearInterval(updateInterval);
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital@0;1&display=swap");

.leaflet-map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
}

/* Индикатор загрузки — правый верхний угол */
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e8dcc8;
  border-top: 2px solid #8b2500;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-text {
  color: #e8dcc8;
  font-size: 12px;
  letter-spacing: 1px;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Кнопка переключения режима (десктоп) */
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
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.mode-btn:hover {
  background: linear-gradient(135deg, #6d5a48, #4e3d2f);
}
.mode-btn.active {
  background: linear-gradient(135deg, #8b2500, #6b1c00);
  border-color: #c4713b;
  color: #ffeedd;
}

/* Бургер-кнопка (мобильные) */
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
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.burger-btn:hover {
  background: linear-gradient(135deg, #6d5a48, #4e3d2f);
}

/* Панель (общие стили) */
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

/* Мобильная версия панели (выезжающая) */
.panel-mobile {
  width: 280px;
  transform: translateX(100%);
  top: 0;
  right: 0;
  height: 100vh;
  border-left: 3px solid #8b7355;
  border-radius: 0;
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

/* Заголовок панели */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 2px solid #8b7355;
}
.panel-logo {
  font-size: 22px;
}
.panel-title {
  font: bold 16px "Cinzel", serif;
  color: #3e2f23;
  letter-spacing: 2px;
}

/* Остальные стили (фильтры, кнопки, списки) без изменений, они уже адаптивны */
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
.hint {
  color: #8b7355;
  font-style: italic;
  font-size: 13px;
}
.coords-line {
  background: rgba(139, 115, 85, 0.15);
  border: 1px solid #c4a87a;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-family: "Courier New", monospace;
  font-size: 12px;
  border-radius: 4px;
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
  object-fit: contain;
}
.filter-item span {
  font: 11px "Cinzel", serif;
  letter-spacing: 1px;
}
.filter-btns {
  display: flex;
  gap: 6px;
}
.filter-btns button {
  flex: 1;
  padding: 6px;
  background: rgba(139, 115, 85, 0.1);
  color: #6d5a48;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: bold 9px "Cinzel", serif;
  letter-spacing: 2px;
  cursor: pointer;
}
.filter-btns button:hover {
  background: rgba(139, 115, 85, 0.25);
}
.type-label {
  font: 11px "Cinzel", serif;
  color: #6d5a48;
  letter-spacing: 2px;
  margin-bottom: 6px;
}
.type-grid {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.type-btn {
  width: 44px;
  height: 44px;
  background: rgba(139, 115, 85, 0.08);
  border: 2px solid #c4a87a;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.45;
}
.type-btn img {
  width: 28px;
  height: 28px;
}
.type-btn.selected {
  background: rgba(139, 115, 85, 0.3);
  border-color: #6d5a48;
  opacity: 1;
}
.panel input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.6);
  color: #3e2f23;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: 13px "Crimson Text", serif;
  margin-bottom: 6px;
}
.form-btns {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.btn-add {
  flex: 1;
  padding: 9px;
  background: linear-gradient(135deg, #8b2500, #6b1c00);
  color: #ffeedd;
  border: none;
  border-radius: 4px;
  font: bold 11px "Cinzel", serif;
  cursor: pointer;
}
.btn-cancel {
  flex: 1;
  padding: 9px;
  background: transparent;
  color: #8b7355;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: bold 11px "Cinzel", serif;
  cursor: pointer;
}
.marker-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.marker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(139, 115, 85, 0.15);
  border: 1px solid #c4a87a;
  border-radius: 4px;
}
.marker-item-icon {
  width: 22px;
  height: 22px;
}
.marker-info {
  flex: 1;
}
.marker-name {
  font-weight: bold;
}
.marker-coords {
  font-size: 10px;
  font-family: monospace;
  color: #6d5a48;
}
.btn-remove {
  background: none;
  border: none;
  color: #a99880;
  font-size: 16px;
  cursor: pointer;
}
.btn-remove:hover {
  color: #8b2500;
}
.panel-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 2px solid #8b7355;
  font-size: 12px;
  text-align: center;
}
.footer-ornament {
  letter-spacing: 6px;
  margin-bottom: 8px;
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

/* Дополнительная адаптация под горизонтальную ориентацию на мобильных */
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
  letter-spacing: 1px;
  color: #ffeedd;
}
.custom-tooltip span {
  color: #c4a87a;
  font-size: 12px;
  font-style: italic;
}
.leaflet-tooltip-top:before {
  border-top-color: #3e2f23;
}
</style>