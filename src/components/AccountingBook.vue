<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-container accounting-modal">
      <div class="modal-header">
        <span>📖 КНИГА УЧЕТА ГИЛЬДИИ</span>
        <button class="modal-close" @click="close">✕</button>
      </div>
      <div v-if="isLoading" class="loading-indicator">
        <div class="spinner"></div>
        <div class="loading-text">Загрузка...</div>
      </div>
      <div class="modal-body">
        <!-- Пароль -->
        <div v-if="!authenticated" class="password-section">
          <div class="field-label">🔐 Запрос доступа у главы гильдии</div>
          <input type="password" v-model="password" placeholder="Введите пароль" @keyup.enter="checkPassword" autofocus />
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        </div>

        <!-- Основной интерфейс -->
        <div v-else class="accounting-section">
          <div class="tab-bar">
            <button :class="{ active: activeTab === 'stock' }" @click="activeTab = 'stock'">📦 Склад</button>
            <button :class="{ active: activeTab === 'treasury' }" @click="activeTab = 'treasury'">💰 Казна</button>
            <button class="tab-graph" @click="openFullChartModal">📊 Графики</button>
          </div>

          <!-- ===== Склад ===== -->
          <div v-if="activeTab === 'stock'" class="stock-tab">
            <div class="add-item-form">
              <div class="form-title">➕ Добавить предмет на склад</div>
              <div class="form-row">
                <div class="form-field">
                  <label>Тип</label>
                  <select v-model="newItem.type">
                    <option value="" disabled>— Выберите —</option>
                    <option v-for="t in filterTags" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="form-field name-field">
                  <label>Название</label>
                  <input v-model="newItem.name" type="text" placeholder="например: Меч"
                    @input="updateNameSuggestions" @focus="updateNameSuggestions" @blur="hideSuggestionsWithDelay" />
                  <ul v-if="showSuggestions && nameSuggestions.length" class="suggestions-list">
                    <li v-for="sug in nameSuggestions" :key="sug" @mousedown.prevent="selectSuggestion(sug)">{{ sug }}</li>
                  </ul>
                </div>
                <div class="form-field">
                  <label>Кол-во</label>
                  <input v-model.number="newItem.quantity" type="number" placeholder="1" @change="checkPositive(newItem, 'quantity')" />
                </div>
                <button @click="addStockItem" class="add-btn" :disabled="addingItem">{{ addingItem ? '⏳' : '➕ Добавить' }}</button>
                <button @click="openBatchModal" class="add-btn batch-btn" :disabled="addingItem">Партией</button>
              </div>
            </div>
            <div class="section-title-small">Предметы гильдии</div>
            <div class="filter-tags">
              <button v-for="tag in filterTags" :key="tag" class="tag-btn"
                :class="{ active: activeTypeFilter === tag && !showEmptyOnly }"
                @click="activeTypeFilter = activeTypeFilter === tag ? '' : tag; showEmptyOnly = false">{{ tag }}</button>
              <button class="tag-btn" :class="{ active: showEmptyOnly }"
                @click="showEmptyOnly = !showEmptyOnly; activeTypeFilter = ''">Требует пополнения</button>
            </div>
            <div class="stock-filters">
              <input type="text" v-model="stockSearch" placeholder="🔍 Поиск по названию..." class="search-input" />
              <div class="sort-controls">
                <span class="sort-label">Сорт. по кол-ву:</span>
                <button :class="['sort-btn', { active: sortOrder === 'asc' }]" @click="sortOrder = sortOrder === 'asc' ? '' : 'asc'">▲</button>
                <button :class="['sort-btn', { active: sortOrder === 'desc' }]" @click="sortOrder = sortOrder === 'desc' ? '' : 'desc'">▼</button>
                <button v-if="sortOrder" class="sort-clear" @click="sortOrder = ''">✕</button>
              </div>
            </div>
            <div class="stock-table-container">
              <table class="stock-table">
                <thead>
                  <tr><th>ID</th><th>Тип</th><th>Название</th><th>Кол-во</th><th>Дата</th><th>Действие</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredStock" :key="item.id">
                    <td>{{ item.id }}</td>
                    <td>{{ item.tape }}</td>
                    <td>{{ item.name }}</td>
                    <td>{{ item.quantity }}</td>
                    <td>{{ item.date }}</td>
                    <td>
                      <button class="plus-btn" @click="openIncreaseDialog(item)" :disabled="processingItemId === item.id">➕</button>
                      <button v-if="item.quantity > 0" class="minus-btn" @click="openDecreaseDialog(item)" :disabled="processingItemId === item.id">➖</button>
                      <button v-if="item.quantity > 0" class="sell-btn" @click="openSellDialog(item)" :disabled="processingItemId === item.id">💰 Продать</button>
                    </td>
                  </tr>
                  <tr v-if="filteredStock.length === 0"><td colspan="6" class="empty-row">Нет записей</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ===== Казна ===== -->
          <div v-if="activeTab === 'treasury'" class="treasury-tab">
            <div class="treasury-summary">
              <div class="total-sum-label">Текущий баланс казны</div>
              <div class="total-sum-value">{{ treasury.total }}</div>
            </div>
            <div class="treasury-actions">
              <div class="action-card income-card">
                <div class="action-title">💰 Пополнение</div>
                <div class="action-fields">
                  <input type="number" v-model.number="incomeAmount" placeholder="Сумма" class="amount-input" />
                  <input type="text" v-model="incomeNote" placeholder="Комментарий" class="note-input" />
                  <button @click="addIncome" class="action-btn income-btn" :disabled="processingFinance">{{ processingFinance ? '⏳' : '➕' }}</button>
                </div>
              </div>
              <div class="action-card expense-card">
                <div class="action-title">💸 Расход</div>
                <div class="action-fields">
                  <input type="number" v-model.number="expenseAmount" placeholder="Сумма" class="amount-input" />
                  <input type="text" v-model="expenseNote" placeholder="Комментарий" class="note-input" />
                  <button @click="addExpense" class="action-btn expense-btn" :disabled="processingFinance">{{ processingFinance ? '⏳' : '➖' }}</button>
                </div>
              </div>
            </div>
            <div class="section-title-small">📜 История операций</div>
            <div class="history-table-container">
              <table class="history-table">
                <thead><tr><th>Дата</th><th>Тип</th><th>Сумма</th><th>Комментарий</th></tr></thead>
                <tbody>
                  <tr v-for="op in treasury.history.slice().reverse().slice(0,20)" :key="op.date + op.amount + op.note">
                    <td class="history-date">{{ op.date }}</td>
                    <td><span :class="op.type==='income'?'badge-income':'badge-expense'">{{ op.type==='income'?'Пополнение':'Расход' }}</span></td>
                    <td :class="op.type==='income'?'amount-income':'amount-expense'">{{ op.type==='income'?'+':'-' }}{{ op.amount }}</td>
                    <td class="history-note">{{ op.note || '—' }}</td>
                  </tr>
                  <tr v-if="treasury.history.length===0"><td colspan="4" class="empty-row">Нет операций</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="close">Закрыть</button>
        <button v-if="authenticated" class="btn-refresh" @click="refreshData">🔄 Обновить</button>
      </div>
    </div>
  </div>

  <!-- ========== ВСПЛЫВАЮЩИЕ ДИАЛОГИ ========== -->
  <!-- Продажа -->
  <div v-if="sellDialog.visible" class="modal-overlay nested" @click.self="closeSellDialog">
    <div class="sell-modal"><div class="sell-header">Продажа: {{ sellDialog.itemName }}</div>
      <div class="sell-body"><div v-if="!sellDialog.loading">
        <div class="sell-field"><label>Кол-во (макс. {{ sellDialog.maxQuantity }}):</label><input type="number" v-model.number="sellDialog.quantity" :max="sellDialog.maxQuantity" min="1" /></div>
        <div class="sell-field"><label>Сумма продажи:</label><input type="number" v-model.number="sellDialog.amount" min="0" step="any" /></div>
        <div class="sell-error" v-if="sellDialog.error">{{ sellDialog.error }}</div>
      </div><div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Обработка...</div></div></div>
      <div class="sell-footer" v-if="!sellDialog.loading"><button @click="closeSellDialog" class="btn-cancel">Отмена</button><button @click="confirmSell" class="btn-sell">✅ Продать</button></div>
    </div>
  </div>

  <!-- Удаление -->
  <div v-if="removeDialog.visible" class="modal-overlay nested" @click.self="closeRemoveDialog">
    <div class="sell-modal"><div class="sell-header">Удаление: {{ removeDialog.itemName }}</div>
      <div class="sell-body"><div v-if="!removeDialog.loading">
        <div class="sell-field"><label>Кол-во (макс. {{ removeDialog.maxQuantity }}):</label><input type="number" v-model.number="removeDialog.quantity" :max="removeDialog.maxQuantity" min="1" /></div>
        <div class="sell-error" v-if="removeDialog.error">{{ removeDialog.error }}</div>
      </div><div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Удаление...</div></div></div>
      <div class="sell-footer" v-if="!removeDialog.loading"><button @click="closeRemoveDialog" class="btn-cancel">Отмена</button><button @click="confirmRemove" class="btn-remove">🗑️ Удалить</button></div>
    </div>
  </div>

  <!-- Увеличение -->
  <div v-if="increaseDialog.visible" class="modal-overlay nested" @click.self="closeIncreaseDialog">
    <div class="sell-modal"><div class="sell-header">📈 Увеличить: {{ increaseDialog.itemName }}</div>
      <div class="sell-body"><div v-if="!increaseDialog.loading">
        <div class="sell-field"><label>Кол-во для добавления:</label><input type="number" v-model.number="increaseDialog.quantity" min="1" /></div>
        <div class="sell-error" v-if="increaseDialog.error">{{ increaseDialog.error }}</div>
      </div><div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Добавление...</div></div></div>
      <div class="sell-footer" v-if="!increaseDialog.loading"><button @click="closeIncreaseDialog" class="btn-cancel">Отмена</button><button @click="confirmIncrease" class="btn-sell">✅ Добавить</button></div>
    </div>
  </div>

  <!-- Уменьшение -->
  <div v-if="decreaseDialog.visible" class="modal-overlay nested" @click.self="closeDecreaseDialog">
    <div class="sell-modal"><div class="sell-header">📉 Уменьшить: {{ decreaseDialog.itemName }}</div>
      <div class="sell-body"><div v-if="!decreaseDialog.loading">
        <div class="sell-field"><label>Кол-во для списания (макс. {{ decreaseDialog.maxQuantity }}):</label><input type="number" v-model.number="decreaseDialog.quantity" :max="decreaseDialog.maxQuantity" min="1" /></div>
        <div class="sell-error" v-if="decreaseDialog.error">{{ decreaseDialog.error }}</div>
      </div><div v-else class="sell-loading"><div class="spinner"></div><div class="loading-text">Списание...</div></div></div>
      <div class="sell-footer" v-if="!decreaseDialog.loading"><button @click="closeDecreaseDialog" class="btn-cancel">Отмена</button><button @click="confirmDecrease" class="btn-remove">➖ Списать</button></div>
    </div>
  </div>

  <!-- Массовое пополнение -->
  <div v-if="batchModalVisible" class="modal-overlay nested" @click.self="closeBatchModal">
    <div class="sell-modal batch-modal"><div class="sell-header">Добавить партией</div>
      <div class="sell-body">
        <div class="batch-table">
          <div class="batch-header"><div class="batch-col">Тип</div><div class="batch-col">Название</div><div class="batch-col">Кол-во</div><div class="batch-col"></div></div>
          <div v-for="(item,idx) in batchItems" :key="idx" class="batch-row">
            <div class="batch-col"><select v-model="item.type"><option value="" disabled>—</option><option v-for="t in filterTags" :value="t">{{ t }}</option></select></div>
            <div class="batch-col name-field"><input v-model="item.name" type="text" placeholder="Название" @input="updateBatchNameSuggestions(idx)" @focus="updateBatchNameSuggestions(idx)" @blur="()=>hideBatchSuggestions(idx)" />
              <ul v-if="item.showSuggestions && item.nameSuggestions?.length" class="suggestions-list"><li v-for="sug in item.nameSuggestions" :key="sug" @mousedown.prevent="selectBatchSuggestion(idx,sug)">{{ sug }}</li></ul>
            </div>
            <div class="batch-col"><input v-model.number="item.quantity" type="number" min="1" /></div>
            <div class="batch-col"><button @click="removeBatchRow(idx)" class="remove-row-btn">✕</button></div>
          </div>
          <button @click="addBatchRow" class="add-row-btn">➕ Добавить строку</button>
        </div>
      </div>
      <div class="sell-footer"><button @click="closeBatchModal" class="btn-cancel">Отмена</button><button @click="submitBatch" class="btn-sell" :disabled="batchSubmitting">{{ batchSubmitting?'⏳ Отправка...':'✅ Отправить всё' }}</button></div>
    </div>
  </div>

  <!-- ===== ПОЛНОЭКРАННАЯ МОДАЛКА С ГРАФИКАМИ (КИНОТЕАТР) ===== -->
  <div v-if="fullChartVisible" class="modal-overlay fullscreen-chart-overlay" @click.self="closeFullChartModal">
    <div class="fullscreen-chart-modal">
      <div class="chart-modal-header">
        <span>📊 Статистика склада</span>
        <button class="modal-close" @click="closeFullChartModal">✕</button>
      </div>
      <div class="chart-modal-tabs">
        <button :class="{ active: chartModalTab === 'sales' }" @click="chartModalTab = 'sales'">График продаж</button>
        <button :class="{ active: chartModalTab === 'inventory' }" @click="chartModalTab = 'inventory'">Визуализация склада</button>
      </div>
      <div class="chart-type-filters">
        <button v-for="type in allTypeFilters" :key="type" class="tag-btn chart-tag-btn"
          :class="{ active: activeChartTypeFilter === type }" @click="activeChartTypeFilter = type">{{ type === 'Все' ? 'Все' : type }}</button>
      </div>
      <div class="charts-grid">
        <div v-if="chartModalTab === 'sales'" class="chart-panel full-width-chart">
          <h3>Продано единиц</h3>
          <apexchart v-if="filteredSalesData.series.length" type="pie" :options="salesChartOptions" :series="filteredSalesData.series"></apexchart>
          <div v-else class="empty-chart">Нет данных</div>
        </div>
        <div v-if="chartModalTab === 'inventory'" class="chart-panel full-width-chart">
          <h3>Текущее количество на складе</h3>
          <apexchart v-if="filteredInventoryData.series.length" type="pie" :options="inventoryChartOptions" :series="filteredInventoryData.series"></apexchart>
          <div v-else class="empty-chart">Нет предметов</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
const ApexChart = VueApexCharts

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const API_URL = "https://script.google.com/macros/s/AKfycbwsicReuI8EkaXFL_VJqwxAD_Ad6dL2lMdSOH_NUMRycDxCiRujPng4EMa-UagnHdJRqQ/exec"
const PASSWORD = "fkmrYgld"

const authenticated = ref(false)
const password = ref("")
const errorMsg = ref("")
const stockItems = ref([])
const treasury = ref({ total: 0, history: [] })
const activeTab = ref("stock")
const stockSearch = ref("")
const incomeAmount = ref(null)
const expenseAmount = ref(null)
const incomeNote = ref("")
const expenseNote = ref("")
const filterTags = ["Оружие", "Расходник", "Ресурс"]
const activeTypeFilter = ref("")
const showEmptyOnly = ref(false)
const newItem = ref({ type: "", name: "", quantity: 1 })
const isLoading = ref(false)
const sortOrder = ref("")
let autoUpdateInterval = null

const addingItem = ref(false)
const processingFinance = ref(false)
const processingItemId = ref(null)
const batchSubmitting = ref(false)

const nameSuggestions = ref([])
const showSuggestions = ref(false)

// Диалоги
const sellDialog = ref({ visible: false, itemId: null, itemName: "", maxQuantity: 0, quantity: 1, amount: 0, error: "", loading: false })
const removeDialog = ref({ visible: false, itemId: null, itemName: "", maxQuantity: 0, quantity: 1, error: "", loading: false })
const increaseDialog = ref({ visible: false, itemId: null, itemName: "", itemType: "", itemPlayer: "", quantity: 1, error: "", loading: false })
const decreaseDialog = ref({ visible: false, itemId: null, itemName: "", maxQuantity: 0, quantity: 1, error: "", loading: false })
const batchModalVisible = ref(false)
const batchItems = ref([])

// Полноэкранный график
const fullChartVisible = ref(false)
// Реактивная высота для графиков (80% от высоты окна минус заголовки/фильтры)
const chartHeight = ref(window.innerHeight * 0.7)

// Обновление высоты при ресайзе
const updateChartHeight = () => {
  chartHeight.value = window.innerHeight * 0.7
}

// Вешаем слушатель при открытии, снимаем при закрытии
watch(fullChartVisible, (val) => {
  if (val) {
    updateChartHeight()
    window.addEventListener('resize', updateChartHeight)
  } else {
    window.removeEventListener('resize', updateChartHeight)
  }
})

// Убираем слушатель на всякий случай при размонтировании
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateChartHeight)
})
const chartModalTab = ref("sales")
const allTypeFilters = ["Все", "Оружие", "Расходник", "Ресурс"]
const activeChartTypeFilter = ref("Все")

const openFullChartModal = () => { fullChartVisible.value = true; chartModalTab.value = "sales"; activeChartTypeFilter.value = "Все" }
const closeFullChartModal = () => { fullChartVisible.value = false }

function checkPositive(obj, field) { if (obj[field] < 1 || isNaN(obj[field])) obj[field] = 1 }

const filteredStockForCharts = computed(() => {
  let items = stockItems.value
  if (activeChartTypeFilter.value !== "Все") items = items.filter(item => item.tape === activeChartTypeFilter.value)
  return items
})

const filteredSalesData = computed(() => {
  const items = filteredStockForCharts.value.filter(i => i.sold_qty && i.sold_qty > 0)
  return { series: items.map(i => i.sold_qty), labels: items.map(i => i.name) }
})

const filteredInventoryData = computed(() => {
  const items = filteredStockForCharts.value.filter(i => i.quantity > 0)
  return { series: items.map(i => i.quantity), labels: items.map(i => i.name) }
})

// Большие палитры (по 50 цветов)
const salesColors = [
  "#8B0000","#A52A2A","#B22222","#C0392B","#E74C3C","#D35400","#E67E22","#F39C12","#D4AC0D","#B8860B",
  "#8E44AD","#6C3483","#2980B9","#1F618D","#117A65","#1E8449","#145A32","#0E6251","#1A5276","#2E86C1",
  "#8B4513","#A0522D","#B5651D","#C85A17","#D2691E","#E07B3A","#BF4F00","#9E2A00","#7B241C","#641E16",
  "#4A235A","#512E5F","#6C3483","#7D3C98","#9B59B6","#8E44AD","#AF7AC5","#A569BD","#BB8FCE","#D2B4DE",
  "#154360","#1B4F72","#21618C","#2874A6","#2E86C1","#3498DB","#5DADE2","#85C1E9","#AED6F1","#D6EAF8"
]
const inventoryColors = [
  "#0B5345","#0E6251","#117A65","#148F77","#1ABC9C","#16A085","#1E8449","#239B56","#28B463","#2ECC71",
  "#145A32","#1D8348","#27AE60","#2ECC71","#58D68D","#82E0AA","#ABEBC6","#D5F5E3","#1A5276","#2471A3",
  "#2E86C1","#3498DB","#5DADE2","#85C1E9","#AED6F1","#D6EAF8","#6C3483","#7D3C98","#9B59B6","#AF7AC5",
  "#512E5F","#6C3483","#884EA0","#A569BD","#BB8FCE","#D2B4DE","#E8DAEF","#78281F","#922B21","#A93226",
  "#C0392B","#E74C3C","#F1948A","#F5B7B1","#FADBD8","#1B2631","#212F3D","#283747","#2C3E50","#34495E"
]

const buildChartOptions = (labels, series, colors) => ({
  chart: {
    type: 'pie',
    background: 'transparent',
    toolbar: { show: false },
    width: 580,
    height: 580,
  },
  labels: labels,
  colors: colors,
  stroke: { width: 0 },        // убираем обводку
  states: {
    hover: {
      filter: { type: 'none' }  // убираем осветление при наведении
    }
  },
  legend: { show: false },
  tooltip: {
    enabled: true,
    // theme не задаём – стилизуем через CSS
    style: {
      fontSize: '14px',
      fontFamily: 'Cinzel, serif',
    },
    y: { formatter: val => `${val} шт.` }
  },
  dataLabels: {
    enabled: true,
    style: {
      colors: ['#ffffff'],
      fontSize: '14px',
      fontFamily: 'Cinzel, serif',
      fontWeight: 'bold'
    },
    formatter: (val, opts) => `${opts.w.config.series[opts.seriesIndex]} шт.`,
    dropShadow: { enabled: true, top: 1, left: 1, blur: 2, color: '#000', opacity: 0.6 }
  },
  responsive: [{
    breakpoint: 600,
    options: { dataLabels: { style: { fontSize: '10px' } } }
  }]
})
const salesChartOptions = computed(() => buildChartOptions(filteredSalesData.value.labels, filteredSalesData.value.series, salesColors))
const inventoryChartOptions = computed(() => buildChartOptions(filteredInventoryData.value.labels, filteredInventoryData.value.series, inventoryColors))

// API
async function callApi(action, body = {}) {
  if (!action) {
    const res = await fetch(`${API_URL}?password=${encodeURIComponent(PASSWORD)}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  } else {
    const fd = new FormData()
    fd.append('password', PASSWORD)
    fd.append('action', action)
    Object.keys(body).forEach(k => fd.append(k, body[k]))
    const res = await fetch(API_URL, { method: 'POST', body: fd })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }
}

async function fetchAccountingData() {
  isLoading.value = true
  try {
    const data = await callApi()
    stockItems.value = data.stock || []
    treasury.value = { total: data.total || 0, history: data.history || [] }
  } catch (e) { errorMsg.value = e.message } finally { isLoading.value = false }
}

async function addStockItem() {
  if (!newItem.value.type || !newItem.value.name || !newItem.value.quantity) return alert("Заполните тип, название и количество")
  addingItem.value = true
  try {
    const { name, type } = getCanonicalNameAndType(newItem.value.name, newItem.value.type)
    await callApi("addStock", { type, name, quantity: newItem.value.quantity, score: 0, player: "Неизвестно" })
    await fetchAccountingData()
    newItem.value = { type: newItem.value.type, name: "", quantity: 1 }
  } catch (e) { alert("Ошибка: " + e.message) } finally { addingItem.value = false }
}

function getCanonicalNameAndType(inputName, inputType) {
  const lower = inputName.trim().toLowerCase()
  const found = stockItems.value.find(i => i.name.toLowerCase() === lower)
  if (found) return { name: found.name, type: found.tape }
  return { name: inputName.trim(), type: inputType }
}

async function addIncome() {
  if (!incomeAmount.value || incomeAmount.value <= 0) return
  processingFinance.value = true
  try { await callApi("addIncome", { amount: incomeAmount.value, note: incomeNote.value }); await fetchAccountingData(); incomeAmount.value = null; incomeNote.value = "" } 
  catch(e) { alert(e.message) } finally { processingFinance.value = false }
}
async function addExpense() {
  if (!expenseAmount.value || expenseAmount.value <= 0) return
  processingFinance.value = true
  try { await callApi("addExpense", { amount: expenseAmount.value, note: expenseNote.value }); await fetchAccountingData(); expenseAmount.value = null; expenseNote.value = "" } 
  catch(e) { alert(e.message) } finally { processingFinance.value = false }
}

async function refreshData() { await fetchAccountingData() }

function checkPassword() {
  if (password.value === PASSWORD) {
    authenticated.value = true; fetchAccountingData(); errorMsg.value = ""
    if (autoUpdateInterval) clearInterval(autoUpdateInterval)
    autoUpdateInterval = setInterval(() => { if (authenticated.value) fetchAccountingData() }, 30000)
  } else { errorMsg.value = "Неверный пароль"; password.value = "" }
}

// Диалоги (сокращены)
function openSellDialog(item) { sellDialog.value = { visible: true, itemId: item.id, itemName: item.name, maxQuantity: item.quantity, quantity: 1, amount: 0, error: "", loading: false } }
function closeSellDialog() { sellDialog.value.visible = false; sellDialog.value.loading = false; sellDialog.value.error = "" }
async function confirmSell() {
  const q = sellDialog.value.quantity, a = sellDialog.value.amount
  if (!q || q<1 || q>sellDialog.value.maxQuantity) { sellDialog.value.error = `Введите от 1 до ${sellDialog.value.maxQuantity}`; return }
  if (a === undefined || a===null || a<0) { sellDialog.value.error = "Введите сумму продажи"; return }
  sellDialog.value.loading = true; sellDialog.value.error = ""; processingItemId.value = sellDialog.value.itemId
  try { await callApi("sellItem", { id: sellDialog.value.itemId, quantity: q, amount: a }); await fetchAccountingData(); closeSellDialog() } 
  catch(e) { sellDialog.value.error = e.message; sellDialog.value.loading = false } finally { processingItemId.value = null }
}

function openRemoveDialog(item) { removeDialog.value = { visible: true, itemId: item.id, itemName: item.name, maxQuantity: item.quantity, quantity: 1, error: "", loading: false } }
function closeRemoveDialog() { removeDialog.value.visible = false; removeDialog.value.loading = false; removeDialog.value.error = "" }
async function confirmRemove() {
  const q = removeDialog.value.quantity
  if (!q || q<1 || q>removeDialog.value.maxQuantity) { removeDialog.value.error = `Введите от 1 до ${removeDialog.value.maxQuantity}`; return }
  removeDialog.value.loading = true; removeDialog.value.error = ""; processingItemId.value = removeDialog.value.itemId
  try { await callApi("removeItem", { id: removeDialog.value.itemId, quantity: q }); await fetchAccountingData(); closeRemoveDialog() } 
  catch(e) { removeDialog.value.error = e.message; removeDialog.value.loading = false } finally { processingItemId.value = null }
}

function openIncreaseDialog(item) { increaseDialog.value = { visible: true, itemId: item.id, itemName: item.name, itemType: item.tape, itemPlayer: item.player||"Неизвестно", quantity: 1, error: "", loading: false } }
function closeIncreaseDialog() { increaseDialog.value.visible = false; increaseDialog.value.loading = false; increaseDialog.value.error = "" }
async function confirmIncrease() {
  const q = increaseDialog.value.quantity
  if (!q || q<1) { increaseDialog.value.error = "Введите положительное число"; return }
  increaseDialog.value.loading = true; increaseDialog.value.error = ""; processingItemId.value = increaseDialog.value.itemId
  try { await callApi("addStock", { type: increaseDialog.value.itemType, name: increaseDialog.value.itemName, quantity: q, score:0, player: increaseDialog.value.itemPlayer }); await fetchAccountingData(); closeIncreaseDialog() } 
  catch(e) { increaseDialog.value.error = e.message; increaseDialog.value.loading = false } finally { processingItemId.value = null }
}

function openDecreaseDialog(item) { decreaseDialog.value = { visible: true, itemId: item.id, itemName: item.name, maxQuantity: item.quantity, quantity: 1, error: "", loading: false } }
function closeDecreaseDialog() { decreaseDialog.value.visible = false; decreaseDialog.value.loading = false; decreaseDialog.value.error = "" }
async function confirmDecrease() {
  const q = decreaseDialog.value.quantity
  if (!q || q<1 || q>decreaseDialog.value.maxQuantity) { decreaseDialog.value.error = `Введите от 1 до ${decreaseDialog.value.maxQuantity}`; return }
  decreaseDialog.value.loading = true; decreaseDialog.value.error = ""; processingItemId.value = decreaseDialog.value.itemId
  try { await callApi("removeItem", { id: decreaseDialog.value.itemId, quantity: q }); await fetchAccountingData(); closeDecreaseDialog() } 
  catch(e) { decreaseDialog.value.error = e.message; decreaseDialog.value.loading = false } finally { processingItemId.value = null }
}

// Массовое пополнение
function openBatchModal() { batchItems.value = [{ type:"", name:"", quantity:1, player:"Неизвестно", nameSuggestions:[], showSuggestions:false }]; batchModalVisible.value = true }
function closeBatchModal() { batchModalVisible.value = false }
function addBatchRow() { batchItems.value.push({ type:"", name:"", quantity:1, player:"Неизвестно", nameSuggestions:[], showSuggestions:false }) }
function removeBatchRow(i) { batchItems.value.splice(i,1) }
function updateBatchNameSuggestions(idx) {
  const item = batchItems.value[idx]; const input = item.name.toLowerCase().trim()
  if (!input) { item.nameSuggestions = []; item.showSuggestions = false; return }
  const all = [...new Set(stockItems.value.map(i=>i.name))]; item.nameSuggestions = all.filter(n => n.toLowerCase().includes(input)); item.showSuggestions = true
}
function selectBatchSuggestion(idx, sug) {
  const item = batchItems.value[idx]; const { name, type } = getCanonicalNameAndType(sug, item.type)
  item.name = name; item.type = type || item.type; item.nameSuggestions = []; item.showSuggestions = false
}
function hideBatchSuggestions(idx) { setTimeout(()=>{ if(batchItems.value[idx]) batchItems.value[idx].showSuggestions = false }, 150) }
async function submitBatch() {
  batchItems.value.forEach(i=>{ if(i.quantity<1||isNaN(i.quantity)) i.quantity=1 })
  const valid = batchItems.value.filter(i=>i.type&&i.name&&i.quantity>0)
  if (!valid.length) { alert('Добавьте хотя бы один заполненный предмет'); return }
  batchSubmitting.value = true
  try { await callApi('addStockBatch', { items: JSON.stringify(valid.map(i=>({ type:i.type, name:i.name, quantity:i.quantity, player:i.player||'Неизвестно' }))) }); await fetchAccountingData(); closeBatchModal() } 
  catch(e) { alert('Ошибка: '+e.message) } finally { batchSubmitting.value = false }
}

// Автодополнение одиночное
const updateNameSuggestions = () => {
  const input = newItem.value.name.toLowerCase().trim()
  if (!input) { nameSuggestions.value = []; showSuggestions.value = false; return }
  const all = [...new Set(stockItems.value.map(i=>i.name))]; nameSuggestions.value = all.filter(n=>n.toLowerCase().includes(input)); showSuggestions.value = true
}
const selectSuggestion = (name) => {
  const { name:canon, type } = getCanonicalNameAndType(name, newItem.value.type)
  newItem.value.name = canon; newItem.value.type = type || newItem.value.type
  nameSuggestions.value = []; showSuggestions.value = false
}
const hideSuggestionsWithDelay = () => { setTimeout(()=>{ showSuggestions.value = false }, 150) }

// Сброс при закрытии
watch(() => props.visible, (val) => {
  if (!val) {
    authenticated.value = false; password.value = ""; errorMsg.value = ""
    activeTab.value = "stock"; stockSearch.value = ""; activeTypeFilter.value = ""; showEmptyOnly.value = false
    fullChartVisible.value = false
    if (autoUpdateInterval) { clearInterval(autoUpdateInterval); autoUpdateInterval = null }
    closeSellDialog(); closeRemoveDialog(); closeIncreaseDialog(); closeDecreaseDialog()
    showSuggestions.value = false; nameSuggestions.value = []
    addingItem.value = false; processingFinance.value = false; processingItemId.value = null; batchSubmitting.value = false
  } else { authenticated.value = false; password.value = ""; errorMsg.value = "" }
})
onBeforeUnmount(() => { if(autoUpdateInterval) clearInterval(autoUpdateInterval) })
function close() { emit('close') }

const filteredStock = computed(() => {
  let f = stockItems.value
  if (showEmptyOnly.value) f = f.filter(i => i.quantity === 0)
  else {
    f = f.filter(i => i.quantity > 0)
    if (activeTypeFilter.value) f = f.filter(i => i.tape === activeTypeFilter.value)
  }
  if (stockSearch.value) { const s = stockSearch.value.toLowerCase(); f = f.filter(i => i.name.toLowerCase().includes(s)) }
  if (sortOrder.value === 'asc') f = [...f].sort((a,b)=>a.quantity-b.quantity)
  else if (sortOrder.value === 'desc') f = [...f].sort((a,b)=>b.quantity-a.quantity)
  return f
})
</script>

<style scoped>
/* ===== ПОЛНЫЕ СТИЛИ (восстановлены и дополнены) ===== */
.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center}
.modal-container{width:90%;max-width:900px;max-height:85vh;background:linear-gradient(135deg,#1e1a16,#2a241f);border-radius:12px;border:2px solid #8b7355;display:flex;flex-direction:column;overflow:hidden;color:#f0e6d0;font-family:'Crimson Text',serif}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0f0c09;border-bottom:1px solid #8b7355;font-family:'Cinzel',serif;font-weight:bold}
.modal-close{background:none;border:none;font-size:24px;cursor:pointer;color:#e8dcc8}
.modal-body{flex:1;overflow-y:auto;padding:16px}
.loading-indicator{position:absolute;top:12px;right:50px;z-index:2100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.7);padding:6px 12px;border-radius:8px;font-family:'Cinzel',serif;backdrop-filter:blur(4px);border:1px solid #8b7355}
.spinner{width:16px;height:16px;border:2px solid #e8dcc8;border-top:2px solid #8b2500;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.loading-text{color:#e8dcc8;font-size:11px}
.password-section{text-align:center;padding:20px}
.password-section input{width:200px;padding:8px;margin-top:10px;background:#2a241f;border:1px solid #8b7355;border-radius:4px;color:#f0e6d0}
.error-msg{color:#e08060;margin-top:8px;font-size:12px}
.tab-bar{display:flex;gap:10px;margin-bottom:20px;border-bottom:2px solid #5c4a3a}
.tab-bar button{background:none;border:none;padding:8px 16px;font-family:'Cinzel',serif;font-weight:bold;cursor:pointer;color:#b8a88a}
.tab-bar button.active{color:#e8a870;border-bottom:3px solid #c4713b}
.tab-graph{cursor:pointer}
.tab-graph:hover{color:#e8a870}
.section-title-small{font-family:'Cinzel',serif;font-weight:bold;margin:16px 0 8px;border-left:4px solid #c4713b;padding-left:8px;color:#e8c8a0;font-size:14px}
.stock-filters{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.search-input{flex:1;min-width:150px;padding:8px;border:1px solid #5c4a3a;border-radius:4px;background:#2a241f;color:#f0e6d0;font-size:13px}
.sort-controls{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:13px}
.sort-label{color:#b8a88a;font-family:'Cinzel',serif;margin-right:4px}
.sort-btn{background:#5c4a3a;border:none;border-radius:4px;color:#f0e6d0;width:28px;height:28px;font-size:14px;cursor:pointer}
.sort-btn.active{background:#8b2500;box-shadow:0 0 4px #c4713b}
.sort-btn:hover{background:#7a6248}
.sort-clear{background:none;border:none;color:#e08060;cursor:pointer;font-size:16px;line-height:1;padding:0 4px}
.stock-table-container{overflow-x:auto}
.stock-table{width:100%;border-collapse:collapse;font-size:13px}
.stock-table th,.stock-table td{border:1px solid #5c4a3a;padding:8px 6px}
.stock-table th{background:#3a2e26;font-family:'Cinzel',serif}
.treasury-summary{background:linear-gradient(135deg,#2a241f,#1e1a16);border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;border:1px solid #c4713b}
.total-sum-label{font-family:'Cinzel',serif;font-size:14px;letter-spacing:2px;color:#b8a88a;margin-bottom:8px}
.total-sum-value{font-size:42px;font-weight:bold;font-family:'Cinzel',serif;color:#e8a870;text-shadow:0 0 8px rgba(200,120,50,0.3)}
.treasury-actions{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px}
.action-card{flex:1;background:rgba(0,0,0,0.3);border-radius:10px;padding:14px;border-left:4px solid}
.income-card{border-left-color:#80c080}
.expense-card{border-left-color:#e08060}
.action-title{font-family:'Cinzel',serif;font-size:15px;font-weight:bold;margin-bottom:12px}
.action-fields{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.amount-input,.note-input{padding:8px;background:#2a241f;border:1px solid #5c4a3a;border-radius:4px;color:#f0e6d0;font-size:14px}
.amount-input{width:110px}
.note-input{flex:2;min-width:150px}
.action-btn{padding:8px 14px;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:13px}
.income-btn{background:#2c6e2c;color:white}
.expense-btn{background:#8b3a2a;color:white}
.history-table-container{overflow-x:auto;margin-top:12px}
.history-table{width:100%;border-collapse:collapse;font-size:14px}
.history-table th{background:#3a2e26;font-family:'Cinzel',serif;padding:10px 8px;text-align:left;border-bottom:2px solid #c4713b}
.history-table td{padding:10px 8px;border-bottom:1px solid #5c4a3a}
.badge-income{background:#2c6e2c;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:bold}
.badge-expense{background:#8b3a2a;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:bold}
.amount-income{color:#80c080;font-weight:bold}
.amount-expense{color:#e08060;font-weight:bold}
.history-date{font-family:monospace;white-space:nowrap;font-size:13px}
.history-note{max-width:250px;word-break:break-word}
.empty-row{text-align:center;padding:20px;color:#a09080}
.modal-footer{display:flex;justify-content:flex-end;gap:12px;padding:12px 16px;border-top:1px solid #5c4a3a}
.btn-cancel,.btn-refresh{padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px}
.btn-cancel{background:transparent;border:1px solid #8b7355;color:#e8dcc8}
.btn-refresh{background:#5c4a3a;border:none;color:#f0e6d0}
.add-item-form{background:rgba(0,0,0,0.4);padding:14px;border-radius:8px;margin-bottom:20px}
.form-title{font-family:'Cinzel',serif;font-size:13px;margin-bottom:12px;color:#e8c8a0}
.form-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.form-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:90px}
.form-field label{font-size:11px;font-family:'Cinzel',serif;color:#b8a88a;text-transform:uppercase}
.form-field select,.form-field input{background:#2a241f;border:1px solid #5c4a3a;border-radius:4px;padding:8px;color:#f0e6d0;font-size:13px}
.add-btn{background:#8b2500;border:none;border-radius:4px;padding:8px 18px;color:white;cursor:pointer;font-weight:bold;height:38px;align-self:flex-end}
.batch-btn{margin-left:8px;background:#5c4a3a}
.filter-tags{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.tag-btn{background:#5c4a3a;border:none;border-radius:4px;padding:6px 12px;color:#f0e6d0;cursor:pointer;font-weight:bold;font-size:12px}
.tag-btn.active{background:#8b2500;box-shadow:0 0 4px #c4713b}
.plus-btn,.minus-btn{background:#3a5a3a;border:none;border-radius:4px;padding:4px 10px;color:white;cursor:pointer;font-size:14px;margin-right:4px}
.minus-btn{background:#7a4a3a}
.sell-btn{background:#8b3a2a;border:none;border-radius:4px;padding:4px 12px;color:white;cursor:pointer;font-family:'Cinzel',serif;font-size:12px}
.modal-overlay.nested{background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);z-index:10001}
.sell-modal{background:#2a241f;border:2px solid #8b7355;border-radius:12px;width:320px;max-width:90%;padding:20px}
.sell-header{font-size:18px;font-weight:bold;margin-bottom:16px;color:#e8a870;text-align:center}
.sell-body{margin-bottom:20px}
.sell-field{margin-bottom:12px}
.sell-field label{display:block;font-size:12px;color:#b8a88a;margin-bottom:4px}
.sell-field input{width:100%;padding:8px;background:#1e1a16;border:1px solid #5c4a3a;border-radius:4px;color:#f0e6d0}
.sell-error{color:#e08060;font-size:12px;margin-top:8px;text-align:center}
.sell-footer{display:flex;justify-content:flex-end;gap:12px}
.btn-sell,.btn-remove{background:#2c6e2c;border:none;border-radius:4px;padding:6px 12px;color:white;cursor:pointer}
.btn-remove{background:#8b3a2a}
.sell-loading{display:flex;flex-direction:column;align-items:center;padding:20px;gap:12px}
.sell-loading .spinner{width:32px;height:32px;border:3px solid #e8dcc8;border-top:3px solid #8b2500}
.name-field{position:relative}
.suggestions-list{position:absolute;top:100%;left:0;right:0;background:#2a241f;border:1px solid #5c4a3a;border-radius:4px;max-height:200px;overflow-y:auto;z-index:3000;list-style:none;padding:0;margin:0}
.suggestions-list li{padding:8px 12px;cursor:pointer;font-size:13px;color:#f0e6d0}
.suggestions-list li:hover{background:#3a2e26}
.batch-modal{width:600px;max-width:90%;display:flex;flex-direction:column;max-height:80vh}
.batch-modal .sell-body{flex:1;overflow-y:auto;padding-right:6px;margin-bottom:0}
.batch-table{width:100%;display:flex;flex-direction:column}
.batch-header,.batch-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.batch-header{font-weight:bold;font-size:12px;color:#e8c8a0;margin-bottom:12px;flex-shrink:0}
.batch-col{flex:1;min-width:0}
.batch-col select,.batch-col input{width:100%;padding:6px;background:#1e1a16;border:1px solid #5c4a3a;border-radius:4px;color:#f0e6d0}
.remove-row-btn{background:#8b3a2a;border:none;border-radius:4px;color:white;width:28px;height:28px;cursor:pointer;flex-shrink:0}
.add-row-btn{margin-top:12px;background:#3a5a3a;border:none;padding:6px 12px;border-radius:4px;color:white;cursor:pointer;flex-shrink:0}
.batch-table .batch-header,.batch-table .add-row-btn{position:sticky;background:#2a241f;z-index:2}
.batch-table .batch-header{top:0}
.batch-table .add-row-btn{bottom:0;margin-top:8px}

/* ===== ПОЛНОЭКРАННАЯ МОДАЛКА ГРАФИКОВ (КИНОТЕАТР) ===== */
.fullscreen-chart-overlay {
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fullscreen-chart-modal {
  width: 95vw;
  height: 95vh;
  background: linear-gradient(135deg, #1e1a16, #2a241f);
  border-radius: 12px;
  border: 2px solid #8b7355;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f0e6d0;
}
.chart-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #0f0c09;
  border-bottom: 1px solid #8b7355;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  flex-shrink: 0;
}
.chart-modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px 0 20px;
  border-bottom: 2px solid #5c4a3a;
  flex-shrink: 0;
}
.chart-modal-tabs button {
  background: none;
  border: none;
  padding: 10px 20px;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  cursor: pointer;
  color: #b8a88a;
  border-bottom: 3px solid transparent;
}
.chart-modal-tabs button.active {
  color: #e8a870;
  border-bottom-color: #c4713b;
}
.chart-type-filters {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  flex-shrink: 0;
}
.chart-tag-btn {
  background: #5c4a3a;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  color: #f0e6d0;
  cursor: pointer;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  font-size: 13px;
}
.chart-tag-btn.active { background: #8b2500; box-shadow: 0 0 4px #c4713b; }
.charts-grid {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
.full-width-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.2);
  border-radius: 12px;
  padding: 10px;
}
.full-width-chart h3 {
  font-family: 'Cinzel', serif;
  color: #e8c8a0;
  margin-bottom: 8px;
  text-align: center;
  flex-shrink: 0;
}
.empty-chart { text-align: center; padding: 40px; color: #b8a88a; font-family: 'Cinzel', serif; }

/* ApexCharts занимает всё доступное пространство */
:deep(.apexcharts-pie) {
  transform: translate(0, 0);
}

@media (max-width: 700px) {
  .fullscreen-chart-modal { width: 100vw; height: 100vh; border-radius: 0; }
}


.charts-grid {
  flex: 1;
  overflow: auto;   /* было hidden */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
.full-width-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.2);
  border-radius: 12px;
  padding: 10px;
}
:deep(.apexcharts-canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* Жёсткие цвета подсказки */
:deep(.apexcharts-tooltip) {
  background: #1e1a16 !important;
  color: #ffffff !important;
  border: 1px solid #8b7355 !important;
  border-radius: 6px;
  font-family: 'Cinzel', serif;
}
:deep(.apexcharts-tooltip .apexcharts-tooltip-title) {
  background: #0f0c09 !important;
  border-bottom: 1px solid #8b7355 !important;
  color: #ffffff !important;
  font-family: 'Cinzel', serif;
}
:deep(.apexcharts-tooltip .apexcharts-tooltip-text-y-label),
:deep(.apexcharts-tooltip .apexcharts-tooltip-text-y-value) {
  color: #ffffff !important;
}
</style>