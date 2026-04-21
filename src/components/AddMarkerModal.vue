<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <span>➕ Добавить метку</span>
        <button class="modal-close" @click="close">✕</button>
      </div>

      <div class="modal-body">
        <!-- Выбор категории, если показываем оба слоя -->
        <div v-if="showCategorySwitch" class="category-switch">
          <button
            :class="{ active: category === 'game' }"
            @click="category = 'game'"
          >
            🏹 Дичь
          </button>
          <button
            :class="{ active: category === 'alchemy' }"
            @click="category = 'alchemy'"
          >
            🌿 Алхимия
          </button>
        </div>

        <!-- Выбор типа (иконки) -->
        <div class="field-label">Тип ресурса</div>
        <div class="type-grid">
          <button
            v-for="type in currentTypeList"
            :key="type.id"
            class="type-btn"
            :class="{ selected: selectedType === type.id }"
            @click="selectedType = type.id"
            :title="type.name"
          >
            <img :src="type.icon" :alt="type.name" />
          </button>
        </div>

        <div class="field-label">Название места</div>
        <input v-model="title" placeholder="Например: Логово волков" @keyup.enter="save" />

        <div class="field-label">Описание</div>
        <textarea v-model="description" placeholder="Что здесь водится или растёт..."></textarea>

        <div class="coords-hint">Координаты: {{ coordsStr }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="close">Отмена</button>
        <button class="btn-add" @click="save">➕ Добавить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  visible: Boolean,
  coords: Object,        // { lat, lng }
  layerMode: String,     // 'game', 'alchemy', 'both'
  gameTypes: Array,      // список типов дичи
  alchemyTypes: Array,   // список типов алхимии
});

const emit = defineEmits(['close', 'save-game', 'save-alchemy']);

const category = ref('game');       // для режима both
const selectedType = ref('');
const title = ref('');
const description = ref('');

// Сброс при открытии
watch(() => props.visible, (newVal) => {
  if (newVal) {
    category.value = 'game';
    selectedType.value = '';
    title.value = '';
    description.value = '';
  }
});

// Показывать ли переключатель категорий
const showCategorySwitch = computed(() => props.layerMode === 'both');

// Актуальный список типов в зависимости от режима
const currentTypeList = computed(() => {
  if (props.layerMode === 'game') return props.gameTypes;
  if (props.layerMode === 'alchemy') return props.alchemyTypes;
  if (props.layerMode === 'both') {
    return category.value === 'game' ? props.gameTypes : props.alchemyTypes;
  }
  return [];
});

// Строка координат для отображения
const coordsStr = computed(() => {
  if (!props.coords) return '';
  return `[${Math.round(props.coords.lat)}, ${Math.round(props.coords.lng)}]`;
});

function save() {
  if (!selectedType.value && currentTypeList.value.length) {
    selectedType.value = currentTypeList.value[0].id;
  }
  if (!selectedType.value) return;

  const payload = {
    coords: `[${Math.round(props.coords.lat)}, ${Math.round(props.coords.lng)}]`,
    type: selectedType.value,
    title: title.value.trim() || 'Без названия',
    description: description.value.trim(),
  };

  if (props.layerMode === 'game') {
    emit('save-game', payload);
  } else if (props.layerMode === 'alchemy') {
    emit('save-alchemy', payload);
  } else if (props.layerMode === 'both') {
    if (category.value === 'game') {
      emit('save-game', payload);
    } else {
      emit('save-alchemy', payload);
    }
  }
  close();
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(3px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-container {
  background: linear-gradient(180deg, #f5efe6, #e8dcc8);
  width: 90%;
  max-width: 450px;
  border-radius: 12px;
  border: 2px solid #8b7355;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  font-family: 'Crimson Text', serif;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 2px solid #c4a87a;
  font-weight: bold;
  font-family: 'Cinzel', serif;
}
.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #8b2500;
}
.modal-body {
  padding: 16px;
}
.category-switch {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.category-switch button {
  flex: 1;
  padding: 8px;
  background: rgba(139,115,85,0.2);
  border: 1px solid #c4a87a;
  border-radius: 30px;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  cursor: pointer;
}
.category-switch button.active {
  background: #8b2500;
  color: white;
  border-color: #8b2500;
}
.field-label {
  font-size: 12px;
  font-family: 'Cinzel', serif;
  margin: 12px 0 6px 0;
  color: #6d5a48;
}
.type-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.type-btn {
  width: 48px;
  height: 48px;
  background: rgba(139,115,85,0.1);
  border: 2px solid #c4a87a;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.6;
}
.type-btn img {
  width: 32px;
  height: 32px;
}
.type-btn.selected {
  opacity: 1;
  border-color: #8b2500;
  background: rgba(139,37,0,0.2);
}
input, textarea {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255,255,255,0.7);
  border: 1px solid #c4a87a;
  border-radius: 6px;
  font-family: inherit;
}
textarea {
  min-height: 70px;
  resize: vertical;
}
.coords-hint {
  margin-top: 12px;
  font-size: 11px;
  color: #6d5a48;
  text-align: center;
  background: rgba(0,0,0,0.05);
  padding: 4px;
  border-radius: 4px;
}
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #c4a87a;
}
.modal-footer button {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}
.btn-add {
  background: linear-gradient(135deg, #8b2500, #6b1c00);
  border: none;
  color: white;
}
.btn-cancel {
  background: transparent;
  border: 1px solid #8b7355;
}
</style>