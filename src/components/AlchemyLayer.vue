<template>
  <div></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';

const props = defineProps({
  map: { type: Object, required: true },
  active: { type: Boolean, default: true },
  editMode: { type: Boolean, default: false },
});

const emit = defineEmits(['toast', 'setPending', 'clearPending']);

const BASE = import.meta.env.BASE_URL;

const alchemyTypes = [
  { id: "herb", name: "Трава", icon: BASE + "herb.png" },
  { id: "mushroom", name: "Гриб", icon: BASE + "mash.png" },
  { id: "flower", name: "Цветок", icon: BASE + "flower.png" },
  { id: "wildberry", name: "Ягоды", icon: BASE + "wildberris.png" },
];

const ALCHEMY_API = "https://script.google.com/macros/s/AKfycbzYoW5mKzznhmrygbOC9g8bITiNKQWRTaGKVSqJ8n4PLdYe2wqB47S656fTK_xIieLYJA/exec";

const markers = ref([]);
const leafletMarkers = [];
const activeFilters = ref(alchemyTypes.map(t => t.id));

const localPendingCoords = ref(null);
const localSelectedType = ref("herb");
const localFormTitle = ref("");
const localFormDescription = ref("");

function addNoCache(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

async function loadMarkers() {
  try {
    const url = `${ALCHEMY_API}?sheet=Herbs`;
    const noCacheUrl = addNoCache(url);
    const res = await fetch(noCacheUrl);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    markers.value = data;
    refreshMarkers();
  } catch (err) {
    emit('toast', `❌ Ошибка загрузки алхимии: ${err.message}`);
  }
}

async function addMarker(marker) {
  const params = new URLSearchParams();
  params.append('coords', marker.coords);
  params.append('type', marker.type);
  params.append('title', marker.title);
  params.append('description', marker.description);
  params.append('sheet', 'Herbs');
  const res = await fetch(ALCHEMY_API, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function addMarkerDirect(marker) {
  return await addMarker(marker);
}

function createIcon(typeId) {
  const iconUrl = alchemyTypes.find(t => t.id === typeId)?.icon;
  return L.divIcon({
    className: '',
    html: `<div class="map-marker-alchemy"><img src="${iconUrl}" alt="" /></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function refreshMarkers() {
  leafletMarkers.forEach(item => {
    if (props.map?.hasLayer(item.marker)) props.map.removeLayer(item.marker);
  });
  leafletMarkers.length = 0;

  markers.value.forEach(m => {
    let coordsArray = JSON.parse(m.coords);
    const marker = L.marker(coordsArray, { icon: createIcon(m.type) })
      .bindTooltip(`<b>${m.title}</b><br><span>${m.description}</span>`, {
        direction: 'top',
        offset: [0, -20],
        className: 'custom-tooltip'
      });
    leafletMarkers.push({ marker, type: m.type, id: m.id });
    if (props.active && activeFilters.value.includes(m.type)) {
      marker.addTo(props.map);
    }
  });
}

function applyFilters() {
  leafletMarkers.forEach(({ marker, type }) => {
    const shouldShow = props.active && activeFilters.value.includes(type);
    if (shouldShow && !props.map.hasLayer(marker)) marker.addTo(props.map);
    if (!shouldShow && props.map.hasLayer(marker)) props.map.removeLayer(marker);
  });
}

async function saveNewMarker() {
  if (!localPendingCoords.value) return;
  const title = localFormTitle.value.trim() || `Ресурс ${markers.value.length + 1}`;
  const description = localFormDescription.value.trim() || '';
  const type = localSelectedType.value;
  const coordsStr = `[${Math.round(localPendingCoords.value.lat)}, ${Math.round(localPendingCoords.value.lng)}]`;
  try {
    await addMarker({ coords: coordsStr, type, title, description });
    await loadMarkers();
    emit('toast', `✅ Добавлен алхимический ресурс: ${title}`);
    cancelLocalPending();
    emit('clearPending');
  } catch (err) {
    emit('toast', `❌ Ошибка: ${err.message}`);
  }
}

function cancelLocalPending() {
  localPendingCoords.value = null;
  localFormTitle.value = '';
  localFormDescription.value = '';
  localSelectedType.value = 'herb';
}

function onMapClick(e) {
  if (!props.editMode || !props.active) return;
  const lat = Math.round(e.latlng.lat);
  const lng = Math.round(e.latlng.lng);
  localPendingCoords.value = { lat, lng };
  localFormTitle.value = '';
  localFormDescription.value = '';
  localSelectedType.value = 'herb';
  emit('setPending', `[${lat}, ${lng}]`);
}

// Следим за активностью слоя
watch(() => props.active, (newVal) => {
  if (newVal) {
    applyFilters();
    if (props.editMode) props.map.on('click', onMapClick);
  } else {
    leafletMarkers.forEach(item => {
      if (props.map.hasLayer(item.marker)) props.map.removeLayer(item.marker);
    });
    props.map.off('click', onMapClick);
  }
});

watch(() => props.editMode, (newVal) => {
  if (props.active) {
    if (newVal) props.map.on('click', onMapClick);
    else props.map.off('click', onMapClick);
  }
});

onMounted(() => {
  loadMarkers(); // загружаем данные один раз при старте
  if (props.active && props.editMode) props.map.on('click', onMapClick);
});

onBeforeUnmount(() => {
  leafletMarkers.forEach(item => {
    if (props.map?.hasLayer(item.marker)) props.map.removeLayer(item.marker);
  });
  if (props.map) props.map.off('click', onMapClick);
});

defineExpose({
  activeFilters,
  alchemyTypes,
  localPendingCoords,
  localSelectedType,
  localFormTitle,
  localFormDescription,
  saveNewMarker,
  cancelLocalPending,
  applyFilters,
  loadMarkers,
  onMapClick,
  addMarkerDirect,
});
</script>