import { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function StlViewer({ arrayBuffer, className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!arrayBuffer || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirA = new THREE.DirectionalLight(0xffffff, 1.2);
    dirA.position.set(1, 2, 3);
    scene.add(dirA);
    const dirB = new THREE.DirectionalLight(0x9fe0d8, 0.4);
    dirB.position.set(-2, -1, -1);
    scene.add(dirB);

    // Load STL
    const loader = new STLLoader();
    const geometry = loader.parse(arrayBuffer);
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();

    // Centre and normalise scale
    const box = geometry.boundingBox;
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    geometry.translate(-centre.x, -centre.y, -centre.z);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 100 / maxDim;
    geometry.scale(scale, scale, scale);

    const material = new THREE.MeshPhongMaterial({ color: 0x0d9488, specular: 0x4dd0c4, shininess: 60 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    camera.position.set(0, 60, 180);
    camera.lookAt(0, 0, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Render loop
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [arrayBuffer]);

  return <div ref={mountRef} className={`w-full rounded-xl overflow-hidden ${className}`} />;
}
