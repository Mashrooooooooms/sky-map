<template>
  <div id="map" class="leaflet-map"></div>

  <!-- Кнопка режима -->
  <button class="mode-btn" :class="{ active: editMode }" @click="toggleMode">
    {{ editMode ? 'Сейчас расставляем' : 'Сейчас смотрим'    }}
  </button>

  <!-- Боковая панель -->
  <div class="panel" :class="{ 'panel-view': !editMode }">

    <!-- Фильтры -->
    <div class="section">
      <div class="section-title">ФИЛЬТР</div>
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
        <div class="section-title">НОВЫЙ МАРКЕР</div>

        <template v-if="pendingCoords">
          <div class="coords-line">{{ pendingCoords }}</div>

          <div class="type-label">Тип</div>
          <div class="type-grid">
            <button
              v-for="type in markerTypes"
              :key="type.id"
              class="type-btn"
              :class="{ selected: selectedType === type.id }"
              @click="selectedType = type.id"
            >
              <img :src="type.icon" :alt="type.name" />
            </button>
          </div>

          <input
            v-model="formTitle"
            placeholder="Название"
            ref="titleInput"
            @keyup.enter="saveMarker"
          />
          <input
            v-model="formDescription"
            placeholder="Описание"
            @keyup.enter="saveMarker"
          />
          <div class="form-btns">
            <button class="btn-add" @click="saveMarker">СКОПИРОВАТЬ</button>
            <button class="btn-cancel" @click="cancelMarker">ОТМЕНА</button>
          </div>
        </template>

        <template v-else>
          <div class="hint">Кликните по карте, чтобы поставить маркер</div>
        </template>
      </div>

      <!-- Список -->
      <div class="section" v-if="placedMarkers.length > 0">
        <div class="section-title">РАЗМЕЩЕНО ({{ placedMarkers.length }})</div>
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

// =====================================================
// ТИПЫ МАРКЕРОВ
const markerTypes = [
  { id: 'elk',   name: 'Олень',   icon: '/elk.png' },
  { id: 'wolf',  name: 'Волк',    icon: '/wolf.png' },
  { id: 'rat',   name: 'Крыса',   icon: '/rat.png' },
  { id: 'bear',  name: 'Медведь', icon: '/bear.png' },
  { id: 'troll', name: 'Тролль',  icon: '/troll.png' },
];
// =====================================================

// =====================================================
// ПОСТОЯННЫЕ МАРКЕРЫ
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

let pendingLatLng     = null;
let mapInstance       = null;

const placedMarkers      = ref([]);
const tempLeafletMarkers = [];
const permanentLeafletMarkers = [];

function getTypeIcon(typeId) {
  return markerTypes.find(t => t.id === typeId)?.icon || '/markers/elk.png';
}

function createLeafletIcon(typeId) {
  return L.icon({
    iconUrl: getTypeIcon(typeId),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
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
      offset: [0, -32],
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

function createTooltipContent(title, description) {
  if (description) {
    return `<b>${title}</b><br><span>${description}</span>`;
  }
  return `<b>${title}</b>`;
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
  toast(`Удалено: ${removed.title}`);
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
  img.src = '/sky.jpg';

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
    L.imageOverlay('/sky.jpg', imageBounds).addTo(map);
    map.fitBounds(imageBounds);
    map.setMaxBounds(imageBounds);

    // Постоянные маркеры с tooltip
    markers.forEach(m => {
      const lm = L.marker(m.coords, {
        icon: createLeafletIcon(m.type),
      })
        .addTo(map)
        .bindTooltip(createTooltipContent(m.title, m.description), {
          direction: 'top',
          offset: [0, -32],
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
.leaflet-map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
}

/* ── Кнопка режима ── */
.mode-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  padding: 8px 16px;
  background: #e8e8e8;
  color: #111;
  border: 2px solid #999;
  font: bold 11px/1 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn.active {
  background: #111;
  color: #e8e8e8;
  border-color: #111;
}

/* ── Панель ── */
.panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 999;
  width: 280px;
  height: 100vh;
  background: #e8e8e8;
  color: #111;
  border-left: 2px solid #999;
  padding: 60px 16px 16px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  display: flex;
  flex-direction: column;
}
.panel-view {
  width: 220px;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 10px;
  letter-spacing: 3px;
  color: #555;
  border-bottom: 1px solid #bbb;
  padding-bottom: 6px;
  margin-bottom: 10px;
}

.hint {
  color: #888;
  font-style: italic;
  font-size: 12px;
}

.coords-line {
  background: #d4d4d4;
  border: 1px solid #bbb;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
  color: #111;
  font-size: 12px;
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
  background: transparent;
  border: 1px solid #bbb;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.5;
}
.filter-item.active {
  background: #d4d4d4;
  border-color: #999;
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
  font-size: 10px;
  letter-spacing: 1px;
  color: #111;
}
.filter-btns {
  display: flex;
  gap: 6px;
}
.filter-btns button {
  flex: 1;
  padding: 6px;
  background: transparent;
  color: #888;
  border: 1px solid #bbb;
  font: bold 9px/1 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
}
.filter-btns button:hover {
  border-color: #555;
  color: #333;
}

/* ── Выбор типа ── */
.type-label {
  font-size: 10px;
  color: #555;
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
  background: transparent;
  border: 2px solid #bbb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  opacity: 0.5;
}
.type-btn img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.type-btn.selected {
  background: #d4d4d4;
  border-color: #555;
  opacity: 1;
}

/* ── Инпуты ── */
.panel input {
  width: 100%;
  padding: 8px 10px;
  background: #f5f5f5;
  color: #111;
  border: 1px solid #bbb;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  margin-bottom: 6px;
  outline: none;
  box-sizing: border-box;
}
.panel input:focus {
  border-color: #111;
}
.panel input::placeholder {
  color: #aaa;
}

/* ── Кнопки формы ── */
.form-btns {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.btn-add {
  flex: 1;
  padding: 8px;
  background: #111;
  color: #e8e8e8;
  border: none;
  font: bold 10px/1 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
}
.btn-add:hover {
  background: #333;
}
.btn-cancel {
  flex: 1;
  padding: 8px;
  background: transparent;
  color: #888;
  border: 1px solid #bbb;
  font: bold 10px/1 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
}
.btn-cancel:hover {
  border-color: #555;
  color: #333;
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
  background: #d4d4d4;
  border: 1px solid #bbb;
}
.marker-item-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.marker-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.marker-name {
  color: #111;
  font-size: 11px;
  font-weight: bold;
}
.marker-coords {
  color: #777;
  font-size: 10px;
}
.btn-remove {
  background: none;
  border: none;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
}
.btn-remove:hover {
  color: #111;
}

.btn-outline {
  width: 100%;
  padding: 8px;
  background: transparent;
  color: #888;
  border: 1px solid #bbb;
  font: bold 10px/1 'Courier New', monospace;
  letter-spacing: 2px;
  cursor: pointer;
}
.btn-outline:hover {
  border-color: #555;
  color: #333;
}

/* ── Подсказка внизу ── */
.panel-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #bbb;
  font-size: 11px;
  color: #777;
  line-height: 1.7;
}
.panel-footer strong {
  color: #111;
}
.panel-footer a {
  color: #111;
  text-decoration: underline;
  font-weight: bold;
}
.panel-footer a:hover {
  color: #555;
}

/* ── Тост ── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: #111;
  color: #e8e8e8;
  padding: 8px 20px;
  font: bold 11px/1 'Courier New', monospace;
  letter-spacing: 2px;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>

<style>
/* ── Tooltip при наведении на маркер ── */
.custom-tooltip {
  background: #111;
  color: #e8e8e8;
  border: none;
  border-radius: 0;
  padding: 8px 12px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.custom-tooltip b {
  display: block;
  margin-bottom: 2px;
  letter-spacing: 1px;
}
.custom-tooltip span {
  color: #aaa;
  font-size: 10px;
}
.leaflet-tooltip-top:before {
  border-top-color: #111;
}
</style>