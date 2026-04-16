<template>
  <MapComponent />
</template>

<script setup>
import MapComponent from './components/MapComponent.vue';
</script>

<style>
/* Убираем ВСЕ отступы у body */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>