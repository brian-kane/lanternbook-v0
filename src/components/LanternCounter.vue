<script setup lang="ts">
import { ref } from 'vue';

const lit = ref(0);
</script>

<template>
  <button type="button" @click="lit++">Lanterns lit: {{ lit }}</button>
</template>
