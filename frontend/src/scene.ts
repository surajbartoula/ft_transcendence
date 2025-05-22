import * as BABYLON from 'babylonjs';

export function setupBabylon() {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const engine = new BABYLON.Engine(canvas, true);

  const createScene = () => {
	const scene = new BABYLON.Scene(engine);

	const camera = new BABYLON.ArcRotateCamera('camera1', Math.PI / 2, Math.PI / 2, 2, BABYLON.Vector3.Zero(), scene);
	camera.attachControl(canvas, true);

	const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(1, 1, 0), scene);

	const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 1 }, scene);

	return scene;
  };

  const scene = createScene();

  engine.runRenderLoop(() => {
	scene.render();
  });

  window.addEventListener('resize', () => {
	engine.resize();
  });
}
