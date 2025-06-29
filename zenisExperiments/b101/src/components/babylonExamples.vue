<template>
  <div>
    <canvas id="renderCanvas"></canvas>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { BasicScene } from '@/babylonExamples/BasicScene';

export default defineComponent({
  name: 'babylonExamples',
  mounted() {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
    if (canvas) {
      new BasicScene(canvas);
    } else {
      console.error("Canvas element not found.");
    }
  }
});
</script>
