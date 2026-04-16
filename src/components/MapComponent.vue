<template>
  <div id="map" class="leaflet-map"></div>

  <!-- Кнопка — левый верхний угол -->
  <button class="mode-btn" :class="{ active: editMode }" @click="toggleMode">
    {{ editMode ? '🏹 Расставляем' : '👁️ Смотрим' }}
  </button>

  <!-- Боковая панель -->
  <div class="panel" :class="{ 'panel-view': !editMode }">

    <!-- Заголовок -->
    <div class="panel-header">
      <span class="panel-logo">🗺️</span>
      <span class="panel-title">Карта дичи</span>
    </div>

    <!-- Фильтры -->
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

    <!-- Форма -->
    <template v-if="editMode">
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
            <button class="btn-add" @click="saveMarker">🏹 СКОПИРОВАТЬ</button>
            <button class="btn-cancel" @click="cancelMarker">ОТМЕНА</button>
          </div>
        </template>

        <template v-else>
          <div class="hint">Кликните по карте, чтобы отметить место</div>
        </template>
      </div>

      <!-- Список -->
      <div class="section" v-if="placedMarkers.length > 0">
        <div class="section-title">🗡️ РАЗМЕЩЕНО ({{ placedMarkers.length }})</div>
        <div class="marker-list">
          <div class="marker-item" v-for="(m, i) in placedMarkers" :key="i">
            <img :src="getTypeIcon(m.type)" class="marker-item-icon" />
            <div class="marker-info">
              <span class="marker-name">{{ m.title }}</span>
              <span class="marker-coords">{{ m.coords }}</span>
            </div>
            <button class="btn-remove" @click="removeMarker(i)">✕</button>
          </div>
        </div>
        <button class="btn-outline" @click="clearAll">ОЧИСТИТЬ ВСЁ</button>
      </div>

      <!-- Подсказка -->
      <div class="panel-footer">
        <div class="footer-ornament">— ◆ —</div>
        Скопированное отправьте<br>
        <strong>Намо гро-Аденну</strong><br>
        в Discord:<br>
        <a href="https://discord.com/users/mashrooooooooms" target="_blank">
          mashrooooooooms
        </a>
      </div>
    </template>

  </div>

  <!-- Тост -->
  <transition name="fade">
    <div class="toast" v-if="toastMsg">{{ toastMsg }}</div>
  </transition>
</template>

<script setup>
import { onMounted, ref, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BASE = import.meta.env.BASE_URL;

// =====================================================
// ТИПЫ МАРКЕРОВ
const markerTypes = [
  { id: 'elk',        name: 'Олень',    icon: BASE + 'elk.png' },
  { id: 'wolf',       name: 'Волк',     icon: BASE + 'wolf.png' },
  { id: 'rat',        name: 'Крыса',    icon: BASE + 'rat.png' },
  { id: 'bear',       name: 'Медведь',  icon: BASE + 'bear.png' },
  { id: 'troll',      name: 'Тролль',   icon: BASE + 'troll.png' },
  { id: 'sabertooth', name: 'Саблезуб', icon: BASE + 'cat.png' },
  // { id: 'mammoth', name: 'Мамонт',  icon: BASE + 'mammoth.png' },
  // { id: 'giant',   name: 'Великан', icon: BASE + 'giant.png' },
];
// =====================================================

// =====================================================
// ПОСТОЯННЫЕ МАРКЕРЫ — вставляй сюда скопированное
const markers = [
  {
    coords: [500, 900],
    type: 'elk',
    title: 'Внезапный олень для примера',
    description: 'Описание того что на точке'
  },
];
// =====================================================

const editMode        = ref(false);
const formTitle       = ref('');
const formDescription = ref('');
const pendingCoords   = ref('');
const selectedType    = ref('elk');
const titleInput      = ref(null);
const toastMsg        = ref('');

const activeFilters = ref(markerTypes.map(t => t.id));

let pendingLatLng          = null;
let mapInstance            = null;

const placedMarkers           = ref([]);
const tempLeafletMarkers      = [];
const permanentLeafletMarkers = [];

function getTypeIcon(typeId) {
  return markerTypes.find(t => t.id === typeId)?.icon || BASE + 'elk.png';
}

function createLeafletIcon(typeId) {
  const iconUrl = getTypeIcon(typeId);
  return L.divIcon({
    className: '',
    html: `
      <div class="map-marker">
        <img src="${iconUrl}" alt="" />
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createTooltipContent(title, description) {
  if (description) {
    return `<b>${title}</b><br><span>${description}</span>`;
  }
  return `<b>${title}</b>`;
}

function toggleMode() {
  editMode.value = !editMode.value;
  cancelMarker();
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = editMode.value ? 'crosshair' : '';
  }
}

async function saveMarker() {
  if (!pendingLatLng) return;

  const title       = formTitle.value.trim() || `Точка ${placedMarkers.value.length + 1}`;
  const description = formDescription.value.trim() || '';
  const type        = selectedType.value;

  const lm = L.marker(pendingLatLng, {
    icon: createLeafletIcon(type),
  })
    .addTo(mapInstance)
    .bindTooltip(createTooltipContent(title, description), {
      direction: 'top',
      offset: [0, -20],
      className: 'custom-tooltip',
    });

  tempLeafletMarkers.push({ marker: lm, type });
  placedMarkers.value.push({ coords: pendingCoords.value, type, title, description });

  const text =
`  {
    coords: ${pendingCoords.value},
    type: '${type}',
    title: '${title}',
    description: '${description}'
  }`;

  await navigator.clipboard.writeText(text);
  toast(`📋 Скопировано: ${title}`);

  pendingCoords.value   = '';
  pendingLatLng         = null;
  formTitle.value       = '';
  formDescription.value = '';
}

function cancelMarker() {
  pendingCoords.value   = '';
  pendingLatLng         = null;
  formTitle.value       = '';
  formDescription.value = '';
}

function removeMarker(i) {
  const removed = placedMarkers.value[i];
  mapInstance.removeLayer(tempLeafletMarkers[i].marker);
  tempLeafletMarkers.splice(i, 1);
  placedMarkers.value.splice(i, 1);
  toast(`🗑️ ${removed.title}`);
}

function clearAll() {
  tempLeafletMarkers.forEach(m => mapInstance.removeLayer(m.marker));
  tempLeafletMarkers.length = 0;
  placedMarkers.value = [];
  toast('Очищено');
}

function selectAllFilters() {
  activeFilters.value = markerTypes.map(t => t.id);
  applyFilters();
}

function clearAllFilters() {
  activeFilters.value = [];
  applyFilters();
}

function applyFilters() {
  permanentLeafletMarkers.forEach(({ marker, type }) => {
    if (activeFilters.value.includes(type)) {
      if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
    } else {
      if (mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
    }
  });

  tempLeafletMarkers.forEach(({ marker, type }) => {
    if (activeFilters.value.includes(type)) {
      if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
    } else {
      if (mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
    }
  });
}

function toast(msg) {
  toastMsg.value = msg;
  setTimeout(() => { toastMsg.value = ''; }, 2000);
}

onMounted(() => {
  const img = new Image();
  img.src = BASE + 'sky.jpg';

  img.onload = () => {
    const boundsH = 1000;
    const boundsW = (img.naturalWidth / img.naturalHeight) * boundsH;
    const imageBounds = [[0, 0], [boundsH, boundsW]];

    const map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 4,
      zoomSnap: 0.25,
      attributionControl: false,
    });

    mapInstance = map;
    L.imageOverlay(BASE + 'sky.jpg', imageBounds).addTo(map);
    map.fitBounds(imageBounds);
    map.setMaxBounds(imageBounds);

    markers.forEach(m => {
      const lm = L.marker(m.coords, {
        icon: createLeafletIcon(m.type),
      })
        .addTo(map)
        .bindTooltip(createTooltipContent(m.title, m.description), {
          direction: 'top',
          offset: [0, -20],
          className: 'custom-tooltip',
        });

      permanentLeafletMarkers.push({ marker: lm, type: m.type });
    });

    map.on('click', (e) => {
      if (!editMode.value) return;
      const lat = Math.round(e.latlng.lat);
      const lng = Math.round(e.latlng.lng);
      pendingCoords.value   = `[${lat}, ${lng}]`;
      pendingLatLng         = e.latlng;
      formTitle.value       = '';
      formDescription.value = '';
      selectedType.value    = 'elk';
      nextTick(() => titleInput.value?.focus());
    });
  };
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital@0;1&display=swap');

.leaflet-map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
}

/* ── Кнопка режима — левый верхний угол ── */
.mode-btn {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  padding: 10px 18px;
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  border: 2px solid #8b7355;
  border-radius: 4px;
  font: bold 12px 'Cinzel', serif;
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

/* ── Панель ── */
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
  padding: 16px 16px 16px;
  overflow-y: auto;
  font-family: 'Crimson Text', serif;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
}
.panel-view {
  width: 220px;
}

/* ── Заголовок панели ── */
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
  font: bold 16px 'Cinzel', serif;
  color: #3e2f23;
  letter-spacing: 2px;
}

.section {
  margin-bottom: 18px;
}

.section-title {
  font: bold 11px 'Cinzel', serif;
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
  font-family: 'Courier New', monospace;
  color: #3e2f23;
  font-size: 12px;
  border-radius: 4px;
}

/* ── Фильтры ── */
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
  transition: all 0.2s;
  opacity: 0.45;
}
.filter-item.active {
  background: rgba(139, 115, 85, 0.25);
  border-color: #8b7355;
  opacity: 1;
  box-shadow: inset 0 0 8px rgba(139, 115, 85, 0.15);
}
.filter-item input { display: none; }
.filter-item img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.filter-item span {
  font: 11px 'Cinzel', serif;
  letter-spacing: 1px;
  color: #3e2f23;
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
  font: bold 9px 'Cinzel', serif;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-btns button:hover {
  background: rgba(139, 115, 85, 0.25);
  border-color: #8b7355;
}

/* ── Выбор типа ── */
.type-label {
  font: 11px 'Cinzel', serif;
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
  transition: all 0.2s;
  opacity: 0.45;
}
.type-btn img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.type-btn.selected {
  background: rgba(139, 115, 85, 0.3);
  border-color: #6d5a48;
  opacity: 1;
  box-shadow: 0 0 8px rgba(139, 115, 85, 0.3);
}

/* ── Инпуты ── */
.panel input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.6);
  color: #3e2f23;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: 13px 'Crimson Text', serif;
  margin-bottom: 6px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.panel input:focus {
  border-color: #6d5a48;
  background: rgba(255, 255, 255, 0.85);
}
.panel input::placeholder {
  color: #a99880;
  font-style: italic;
}

/* ── Кнопки формы ── */
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
  font: bold 11px 'Cinzel', serif;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(139, 37, 0, 0.3);
}
.btn-add:hover {
  background: linear-gradient(135deg, #a03000, #7d2200);
}
.btn-cancel {
  flex: 1;
  padding: 9px;
  background: transparent;
  color: #8b7355;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: bold 11px 'Cinzel', serif;
  letter-spacing: 1px;
  cursor: pointer;
}
.btn-cancel:hover {
  border-color: #6d5a48;
  color: #3e2f23;
}

/* ── Список маркеров ── */
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
  object-fit: contain;
}
.marker-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.marker-name {
  color: #3e2f23;
  font: bold 12px 'Crimson Text', serif;
}
.marker-coords {
  color: #8b7355;
  font: 10px 'Courier New', monospace;
}
.btn-remove {
  background: none;
  border: none;
  color: #a99880;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
}
.btn-remove:hover {
  color: #8b2500;
}

.btn-outline {
  width: 100%;
  padding: 8px;
  background: transparent;
  color: #8b7355;
  border: 1px solid #c4a87a;
  border-radius: 4px;
  font: bold 10px 'Cinzel', serif;
  letter-spacing: 2px;
  cursor: pointer;
}
.btn-outline:hover {
  border-color: #6d5a48;
  color: #3e2f23;
}

/* ── Подсказка внизу ── */
.panel-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 2px solid #8b7355;
  font-size: 12px;
  color: #6d5a48;
  line-height: 1.7;
  text-align: center;
}
.footer-ornament {
  color: #c4a87a;
  font-size: 14px;
  margin-bottom: 8px;
  letter-spacing: 6px;
}
.panel-footer strong {
  color: #3e2f23;
}
.panel-footer a {
  color: #8b2500;
  text-decoration: none;
  font-weight: bold;
  border-bottom: 1px dashed #8b2500;
}
.panel-footer a:hover {
  color: #a03000;
}

/* ── Тост ── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  padding: 10px 24px;
  font: bold 12px 'Cinzel', serif;
  letter-spacing: 1px;
  border: 1px solid #8b7355;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>

<style>
/* ── Маркер на карте ── */
.map-marker {
  width: 36px;
  height: 36px;
  background: radial-gradient(circle, #c0392b, #8b2500);
  border: 3px solid #e8dcc8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 2px 8px rgba(139, 37, 0, 0.5),
    0 0 0 2px rgba(139, 37, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s;
}
.map-marker:hover {
  transform: scale(1.2);
}
.map-marker img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: brightness(10);
}

/* ── Tooltip ── */
.custom-tooltip {
  background: linear-gradient(135deg, #5c4a3a, #3e2f23);
  color: #e8dcc8;
  border: 1px solid #8b7355;
  border-radius: 4px;
  padding: 8px 14px;
  font-family: 'Crimson Text', serif;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.custom-tooltip b {
  display: block;
  margin-bottom: 3px;
  font-family: 'Cinzel', serif;
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