const $ = (selector) => document.querySelector(selector);
const viewport = $('#building-viewport');
const loading = $('#scene-loading');
const rooms = [
  { id:'sala', name:'Sala de estar', area:'24 m²', x:-1.9, z:1.55, w:3.4, d:2.45, color:0x8ab4c7, description:'Ambiente social integrado, com área de estar, sofá em L, mesa de centro e conexão com a varanda.' },
  { id:'jantar', name:'Sala de jantar', area:'12 m²', x:1.75, z:1.55, w:2.7, d:2.45, color:0xc7a37c, description:'Espaço de refeições com mesa central e circulação para cozinha e sala.' },
  { id:'cozinha', name:'Cozinha', area:'11 m²', x:2.05, z:-1.15, w:2.4, d:2.4, color:0xa9c6ac, description:'Cozinha com bancada/ilha, pia, armários, cooktop e geladeira.' },
  { id:'suite', name:'Suíte', area:'16 m²', x:-2.05, z:-1.25, w:3.2, d:2.7, color:0xb5a0ca, description:'Quarto principal com cama de casal, criados-mudos e armário. Possui banheiro privativo demonstrativo.' },
  { id:'quarto', name:'Quarto 02', area:'10 m²', x:0.5, z:-3.6, w:2.3, d:1.35, color:0xc1b18e, description:'Quarto secundário com cama, armário e espaço de estudo.' },
  { id:'banho', name:'Banheiro social', area:'4 m²', x:2.9, z:-3.6, w:1.7, d:1.35, color:0x91b9c7, description:'Banheiro com bancada, lavatório, vaso sanitário e área de banho.' },
  { id:'servico', name:'Área de serviço', area:'5 m²', x:3.25, z:-2.0, w:1.2, d:1.2, color:0x9caa9f, description:'Espaço funcional com tanque, máquina de lavar e armários de apoio.' },
  { id:'varanda', name:'Varanda', area:'8 m²', x:-1.6, z:3.45, w:3.7, d:1.25, color:0x85b8bc, description:'Varanda frontal com guarda-corpo e espaço para duas poltronas.' }
];
let THREE, OrbitControls, renderer, scene, camera, controls, raycaster, pointer;
let buildingGroup, apartmentGroup, neighborhoodGroup, floorGroups = [], roomMeshes = [], floorPickMeshes = [];
let selectedFloor = -1, hoveredFloor = -1, floorCount = 8;
let mode = 'building', cameraMode = 'orbit', selectedRoom = null, transparentWalls = false;
let pointerDownPos = null, isDragging = false;
const mats = {};
const FLOOR_H = 2.72;

function material(name, color, roughness = .7, metalness = .05) {
  if (mats[name]) return mats[name];
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (['wood', 'aptfloor', 'slab', 'wall', 'counter'].includes(name)) m.map = surfaceTexture(name === 'wood' || name === 'aptfloor');
  return mats[name] = m;
}

function surfaceTexture(wood = false) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#e6dfd3'; x.fillRect(0, 0, 256, 256); let seed = 41;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = 'rgba(45,35,25,' + (random() * .17) + ')';
    x.fillRect(random() * 256, random() * 256, wood ? random() * 70 : 2, 1);
  }
  if (wood) {
    x.strokeStyle = '#44301f40';
    for (let y = 0; y < 256; y += 32) {
      x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke();
      x.strokeRect(y % 64 ? 55 : 0, y, 128, 32);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}

function box(parent, w, h, d, x, y, z, mat, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone ? mat.clone() : mat);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  if (opts.name) mesh.name = opts.name;
  if (opts.room) { mesh.userData.room = opts.room; roomMeshes.push(mesh); }
  if (opts.floorIndex !== undefined) { mesh.userData.floorIndex = opts.floorIndex; floorPickMeshes.push(mesh); }
  mesh.userData.structural = (h < .3 || h > 2.5) && !opts.room;
  parent.add(mesh); return mesh;
}

function cyl(parent, rTop, rBot, h, x, y, z, mat, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, opts.seg || 12), mat.clone ? mat.clone() : mat);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}

function addBuildingFloor(index) {
  const g = new THREE.Group(); g.position.y = index * FLOOR_H;
  const slab = material('slab', 0x9aa8b7, .85).clone();
  const wall = material('wall', 0xe8ecef, .72).clone();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5ec9dd, roughness: .14, metalness: .12, transparent: true, opacity: .52, transmission: .18 });
  const dark = material('dark', 0x24374e, .55).clone();
  const balcony = material('balcony', 0x74879a, .65).clone();
  const accent = material('accent', 0xc9a66b, .45, .15).clone();

  // Slab + ceiling line
  box(g, 8.4, .2, 7.3, 0, 0, 0, slab);
  box(g, 8.2, .08, 7.1, 0, 2.52, 0, dark);

  // Walls
  box(g, 8.2, 2.45, .16, 0, 1.25, -3.5, wall);
  box(g, .16, 2.45, 7.1, -4.08, 1.25, 0, wall);
  box(g, .16, 2.45, 7.1, 4.08, 1.25, 0, wall);

  // Front glazing + frame
  box(g, 8.2, .14, .14, 0, 2.48, 3.5, dark);
  box(g, 8.2, .14, .14, 0, .12, 3.5, dark);
  for (let i = 0; i < 4; i++) {
    const gx = -2.95 + i * 1.95;
    box(g, 1.7, 1.9, .08, gx, 1.28, 3.48, glass, { floorIndex: index });
    box(g, .08, 2.1, .12, gx - .88, 1.28, 3.5, dark);
  }
  box(g, .08, 2.1, .12, 2.95 + .88, 1.28, 3.5, dark);

  // Balcony (one per floor / one apartment)
  box(g, 6.0, .14, 1.5, 0, .14, 4.28, balcony);
  box(g, 6.0, .75, .06, 0, .55, 5.0, glass);
  for (let x = -2.85; x <= 2.86; x += .48) box(g, .04, .75, .06, x, .55, 5.0, dark);
  box(g, 6.1, .06, .08, 0, .92, 5.0, accent);

  // Columns
  for (const x of [-4.1, 4.1]) for (const z of [-3.55, 3.55]) box(g, .28, 2.65, .28, x, 1.32, z, dark);

  // Invisible pick volume for the whole floor (easier click/hover)
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 2.6, 8.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pick.position.set(0, 1.3, .3);
  pick.userData.floorIndex = index;
  g.add(pick);
  floorPickMeshes.push(pick);

  g.userData.floor = index + 1;
  g.userData.floorIndex = index;
  buildingGroup.add(g);
  floorGroups.push(g);
}

function makeNeighborhood() {
  neighborhoodGroup = new THREE.Group();
  const asphalt = material('asphalt', 0x2a2f36, .95);
  const curb = material('curb', 0x8a8f96, .8);
  const grass = material('grass', 0x3d6b45, .9);
  const treeTrunk = material('trunk', 0x5c4033, .85);
  const foliage = material('foliage', 0x2f6b3a, .75);
  const house = material('house', 0xd4c4b0, .8);
  const roof = material('nroof', 0x5a4a3a, .7);

  // Street in front
  box(neighborhoodGroup, 28, .08, 6, 0, -.28, 10, asphalt);
  box(neighborhoodGroup, 28, .12, .4, 0, -.2, 7.2, curb);
  box(neighborhoodGroup, 28, .12, .4, 0, -.2, 12.8, curb);

  // Sidewalks / grass patches
  box(neighborhoodGroup, 14, .06, 4, -12, -.26, 4, grass);
  box(neighborhoodGroup, 14, .06, 4, 12, -.26, 4, grass);
  box(neighborhoodGroup, 40, .05, 18, 0, -.32, -8, grass);

  // Simple neighboring buildings (low detail, discrete)
  const neighbors = [
    { x: -14, z: -6, w: 5, d: 6, h: 5 },
    { x: 14, z: -5, w: 4.5, d: 5.5, h: 4.2 },
    { x: -12, z: 4, w: 3.5, d: 3, h: 3.2 },
    { x: 13, z: 3.5, w: 3.2, d: 3.2, h: 2.8 }
  ];
  neighbors.forEach(n => {
    box(neighborhoodGroup, n.w, n.h, n.d, n.x, n.h / 2 - .2, n.z, house);
    box(neighborhoodGroup, n.w + .3, .25, n.d + .3, n.x, n.h - .05, n.z, roof);
  });

  // Trees (simple)
  const treePos = [[-7, 6], [7, 6.5], [-9, -2], [9, -3], [-6, -10], [6, -9], [0, -12]];
  treePos.forEach(([x, z]) => {
    cyl(neighborhoodGroup, .12, .18, 1.4, x, .5, z, treeTrunk, { seg: 8 });
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.7, 10, 8), foliage.clone());
    leaf.position.set(x, 1.6, z); leaf.castShadow = true;
    neighborhoodGroup.add(leaf);
  });

  // Low bushes near entrance
  [[-3.5, 5.5], [3.5, 5.5], [-5, 5.2], [5, 5.2]].forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(.35, 8, 6), foliage.clone());
    b.position.set(x, .1, z); b.scale.y = .6;
    neighborhoodGroup.add(b);
  });

  scene.add(neighborhoodGroup);
}

function makeApartment() {
  apartmentGroup = new THREE.Group();
  roomMeshes = [];
  const floorMat = material('aptfloor', 0xb9a997, .9);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: .88, transparent: false, opacity: 1 });
  box(apartmentGroup, 8, .16, 8, 0, 0, 0, floorMat);

  const roomFloorMat = {};
  rooms.forEach(r => {
    const m = new THREE.MeshStandardMaterial({ color: r.color, roughness: .9, transparent: true, opacity: .88, side: THREE.DoubleSide });
    const floor = box(apartmentGroup, r.w, .04, r.d, r.x, .11, r.z, m, { name: r.name, room: r });
    floor.userData.room = r;
    roomFloorMat[r.id] = m;
  });

  const walls = [];
  walls.push(box(apartmentGroup, 8, .95, .14, 0, .55, -3.92, wallMat));
  walls.push(box(apartmentGroup, .14, .95, 8, -3.92, .55, 0, wallMat));
  walls.push(box(apartmentGroup, .14, .95, 8, 3.92, .55, 0, wallMat));
  walls.push(box(apartmentGroup, 2.9, .85, .12, -2.55, .5, 0, wallMat));
  walls.push(box(apartmentGroup, 2.4, .85, .12, 1.9, .5, -.05, wallMat));
  walls.push(box(apartmentGroup, .12, .85, 2.2, .2, .5, -2.9, wallMat));
  walls.push(box(apartmentGroup, 2.3, .85, .12, 2.5, .5, -2.8, wallMat));
  apartmentGroup.userData.walls = walls;

  const fabric = material('fabric', 0x425b76);
  const wood = material('wood', 0x805b42);
  const cream = material('cream', 0xd2c7b7);
  const metal = material('metal', 0x9aa7b2, .35, .6);
  const bed = material('bed', 0x697c9f);
  const pillow = material('pillow', 0xe9e6df);
  const porcelain = material('porcelain', 0xf0f3f3, .2);
  const green = material('plant', 0x4b8a65);
  const darkWood = material('darkwood', 0x4a3224, .75);

  // Living: L-sofa + coffee table + rug hint
  box(apartmentGroup, 2.1, .42, .78, -2.5, .38, 1.55, fabric); // long seat
  box(apartmentGroup, 2.1, .52, .14, -2.5, .66, 1.9, fabric); // back
  box(apartmentGroup, .7, .42, 1.4, -1.45, .38, 1.2, fabric); // L arm
  box(apartmentGroup, .9, .08, .55, -2.0, .22, 1.0, wood); // table
  box(apartmentGroup, .75, .03, .4, -2.0, .28, 1.0, cream);

  // Dining: table + 4 chairs
  box(apartmentGroup, 1.4, .08, .9, 1.7, .76, 1.5, wood);
  box(apartmentGroup, .12, .7, .12, 1.15, .38, 1.15, darkWood);
  box(apartmentGroup, .12, .7, .12, 2.25, .38, 1.15, darkWood);
  box(apartmentGroup, .12, .7, .12, 1.15, .38, 1.85, darkWood);
  box(apartmentGroup, .12, .7, .12, 2.25, .38, 1.85, darkWood);
  for (const [x, z] of [[1.15, 1.05], [2.15, 1.05], [1.15, 1.95], [2.15, 1.95]]) {
    box(apartmentGroup, .38, .08, .38, x, .42, z, fabric);
    box(apartmentGroup, .38, .4, .06, x, .62, z + (z < 1.5 ? -.12 : .12), fabric);
  }

  // Kitchen: counter, island feel, fridge, sink, hob
  box(apartmentGroup, 2.2, .82, .55, 2.55, .52, -1.45, cream);
  box(apartmentGroup, 2.25, .06, .58, 2.55, .95, -1.45, material('counter', 0x65717b, .35));
  box(apartmentGroup, .55, .04, .35, 2.1, 1.0, -1.45, metal); // sink
  box(apartmentGroup, .5, .03, .35, 2.85, 1.0, -1.45, metal); // hob
  box(apartmentGroup, .7, 1.75, .65, 3.35, .95, -2.45, material('fridge', 0xdfe8ed, .25, .15));
  // upper cabinets
  box(apartmentGroup, 1.8, .45, .35, 2.4, 1.85, -1.55, cream);

  // Suite bed + nightstands + wardrobe
  box(apartmentGroup, 1.7, .35, 2.05, -2.15, .28, -1.15, bed);
  box(apartmentGroup, 1.7, .1, .45, -2.15, .48, -1.95, pillow);
  box(apartmentGroup, .4, .4, .4, -3.15, .28, -.4, darkWood);
  box(apartmentGroup, .4, .4, .4, -1.15, .28, -.4, darkWood);
  box(apartmentGroup, .65, 1.9, .55, -3.4, .98, -2.6, wood);

  // Quarto 02
  box(apartmentGroup, 1.3, .28, 1.75, .4, .24, -3.5, bed);
  box(apartmentGroup, 1.3, .08, .38, .4, .4, -4.15, pillow);
  box(apartmentGroup, .5, 1.6, .4, 1.4, .85, -3.9, wood);

  // Bathroom fixtures
  box(apartmentGroup, .6, .4, .55, 2.8, .3, -3.4, porcelain);
  box(apartmentGroup, .42, .55, .42, 3.25, .35, -3.7, porcelain);
  box(apartmentGroup, .55, .9, .45, 3.3, .5, -2.15, material('washer', 0xd5dde0, .3));

  // Service / laundry already partially covered
  // Balcony chairs + plants
  box(apartmentGroup, .5, .32, .5, -2.7, .26, 3.4, wood);
  box(apartmentGroup, .5, .32, .5, -1.9, .26, 3.4, wood);
  cyl(apartmentGroup, .18, .22, .5, 2.5, .35, 3.45, green, { seg: 8 });
  cyl(apartmentGroup, .12, .15, .35, -0.5, .25, 3.5, green, { seg: 8 });

  // Soft ambient light inside apartment
  const aptLight = new THREE.PointLight(0xfff0dd, 18, 12);
  aptLight.position.set(0, 2.2, 0);
  apartmentGroup.add(aptLight);

  apartmentGroup.userData.roomFloors = roomFloorMat;
  scene.add(apartmentGroup);
  apartmentGroup.visible = false;
}

function updateFloorOpacity() {
  floorGroups.forEach((g, i) => {
    const selected = selectedFloor < 0 || i === selectedFloor;
    const hover = i === hoveredFloor && mode === 'building';
    const lift = (i === selectedFloor && mode === 'building') ? 0.35 : (hover ? 0.12 : 0);
    g.position.y = i * FLOOR_H + lift;
    g.traverse(o => {
      if (o.isMesh && o.material && o.material.visible !== false && !(o.material instanceof THREE.MeshBasicMaterial && !o.material.visible)) {
        if (o.userData.baseOpacity === undefined) {
          o.userData.baseOpacity = o.material.opacity !== undefined ? o.material.opacity : 1;
          o.userData.baseTransparent = !!o.material.transparent;
        }
        if (selected || selectedFloor < 0) {
          o.material.transparent = o.userData.baseTransparent;
          o.material.opacity = o.userData.baseOpacity;
          if (hover && selectedFloor < 0) {
            o.material.emissive = o.material.emissive || new THREE.Color(0x000000);
            if (o.material.emissive) o.material.emissive.setHex(0x1a3040);
          } else if (o.material.emissive) {
            o.material.emissive.setHex(0x000000);
          }
        } else {
          o.material.transparent = true;
          o.material.opacity = 0.18;
          if (o.material.emissive) o.material.emissive.setHex(0x000000);
        }
      }
    });
  });
}

function setMode(next) {
  if (next === 'apartment' && selectedFloor < 0) selectedFloor = 0;
  mode = next;
  buildingGroup.visible = next === 'building';
  apartmentGroup.visible = next === 'apartment';
  if (neighborhoodGroup) neighborhoodGroup.visible = next === 'building';
  $('#scene-title').textContent = next === 'building'
    ? 'Edifício residencial · visão externa'
    : 'Apartamento ' + String(selectedFloor + 1).padStart(2, '0') + ' · unidade única do pavimento';
  $('#scene-subtitle').textContent = next === 'building'
    ? 'Clique no andar para selecionar · arraste para orbitar · scroll/pinça para zoom'
    : 'Clique nos ambientes para consultar suas características';
  $('#back-building').classList.toggle('hidden', next === 'building');
  ['view-plan', 'view-perspective', 'view-interior', 'toggle-walls'].forEach(id => $('#' + id).disabled = next === 'building');
  if (next === 'apartment') {
    camera.position.set(0, 16, .01);
    controls.target.set(0, 0, 0);
    controls.minDistance = 2;
    controls.update();
    $('#room-title').textContent = 'Planta do apartamento';
    $('#room-description').textContent = 'Uma unidade residencial por pavimento, com ambientes e mobiliário demonstrativos. Selecione um cômodo na cena ou na lista.';
  } else {
    camera.position.set(14, 10, 16);
    controls.target.set(0, floorCount * 1.2, 0);
    controls.minDistance = 7;
    controls.update();
    $('#room-title').textContent = 'Conheça o apartamento';
    $('#room-description').textContent = 'O edifício possui exatamente um apartamento por andar. Clique diretamente no pavimento ou use a grade lateral.';
  }
  updateFloorButtons();
  if (next === 'building') fitScene();
}

function updateFloorButtons() {
  const boxEl = $('#floor-selector');
  boxEl.replaceChildren();
  for (let i = floorCount; i >= 1; i--) {
    const b = document.createElement('button');
    b.className = 'floor-btn' + (i - 1 === selectedFloor ? ' active' : '');
    b.textContent = `${i}º`;
    b.setAttribute('aria-label', `Selecionar ${i}º andar`);
    b.addEventListener('click', () => selectFloor(i - 1, true));
    boxEl.append(b);
  }
  $('#unit-total').textContent = String(floorCount).padStart(2, '0');
}

function selectFloor(index, openHint = false) {
  selectedFloor = Math.max(0, Math.min(floorCount - 1, index));
  hoveredFloor = -1;
  updateFloorOpacity();
  updateFloorButtons();
  $('#scene-title').textContent = `Pavimento ${selectedFloor + 1} selecionado · 01 apartamento`;
  $('#room-title').textContent = `${selectedFloor + 1}º pavimento`;
  $('#room-description').textContent = `Unidade residencial ${String(selectedFloor + 1).padStart(2, '0')}: um único apartamento neste andar. Abra a unidade para explorar os ambientes.`;
  // Smooth camera approach toward selected floor
  if (mode === 'building' && camera && controls) {
    const y = selectedFloor * FLOOR_H + 1.2;
    const target = new THREE.Vector3(0, y, 0);
    const pos = new THREE.Vector3(11, y + 3.5, 13);
    camera.position.lerp(pos, 0.35);
    controls.target.lerp(target, 0.4);
    controls.update();
  }
  if (openHint) {
    // optional visual feedback only
  }
}

function selectRoom(room) {
  controls.minDistance = .3;
  camera.position.set(room.x + 3, 6.5, room.z + 4.5);
  controls.target.set(room.x, .3, room.z);
  controls.update();
  selectedRoom = room;
  roomMeshes.forEach(m => {
    const c = m.userData.room;
    if (c) m.material.color.setHex(c.id === room.id ? 0xff606a : c.color);
  });
  $('#room-title').textContent = room.name + ' · ' + room.area;
  $('#room-description').textContent = room.description;
  document.querySelectorAll('.room-btn').forEach(b => b.classList.toggle('active', b.dataset.room === room.id));
}

function buildRoomList() {
  const list = $('#room-list');
  list.replaceChildren();
  rooms.forEach(room => {
    const b = document.createElement('button');
    b.className = 'room-btn';
    b.dataset.room = room.id;
    b.innerHTML = `<span>${room.name}</span><small>${room.area}</small>`;
    b.addEventListener('click', () => {
      if (mode !== 'apartment') setMode('apartment');
      selectRoom(room);
    });
    list.append(b);
  });
}

function resize() {
  if (!renderer) return;
  const w = Math.max(1, viewport.clientWidth), h = Math.max(1, viewport.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  fitScene();
}

function getFloorFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(floorPickMeshes, true);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && obj.userData.floorIndex === undefined) obj = obj.parent;
    if (obj && obj.userData.floorIndex !== undefined) return obj.userData.floorIndex;
  }
  return -1;
}

function onPointerMove(event) {
  if (mode !== 'building' || isDragging) return;
  const idx = getFloorFromEvent(event);
  if (idx !== hoveredFloor) {
    hoveredFloor = idx;
    updateFloorOpacity();
    if (idx >= 0) {
      $('#scene-subtitle').textContent = `Andar ${idx + 1} · clique para selecionar`;
    } else {
      $('#scene-subtitle').textContent = 'Clique no andar para selecionar · arraste para orbitar · scroll/pinça para zoom';
    }
  }
}

function onSceneClick(event) {
  if (isDragging) return;
  if (mode === 'building') {
    const idx = getFloorFromEvent(event);
    if (idx >= 0) {
      selectFloor(idx);
      return;
    }
  }
  if (mode === 'apartment') {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(roomMeshes, false);
    if (hits.length && hits[0].object.userData.room) selectRoom(hits[0].object.userData.room);
  }
}

function setActive(id) {
  ['view-plan', 'view-perspective', 'view-interior'].forEach(k => $('#' + k).classList.toggle('active', k === id));
}
function setCameraActive(id) {
  ['camera-orbit', 'camera-front', 'camera-side', 'camera-rear', 'camera-top'].forEach(k => {
    const el = $('#' + k);
    if (el) el.classList.toggle('active', k === id);
  });
}

function rebuildFloors() {
  // clear previous pick meshes
  floorPickMeshes = [];
  buildingGroup.clear();
  floorGroups = [];
  floorCount = Number($('#floor-count').value);
  for (let i = 0; i < floorCount; i++) addBuildingFloor(i);
  box(buildingGroup, 8.6, .3, 7.5, 0, floorCount * FLOOR_H, 0, material('roof', 0x263b54, .5));
  box(buildingGroup, 9.2, .7, 8.2, 0, -.2, 0, material('podium', 0x607286, .75));
  // entrance canopy
  box(buildingGroup, 3.2, .12, 2.2, 0, 2.6, 4.2, material('dark', 0x24374e, .55));
  selectedFloor = Math.min(selectedFloor, floorCount - 1);
  if (selectedFloor < 0) selectedFloor = -1;
  updateFloorOpacity();
  updateFloorButtons();
  controls.target.set(0, floorCount * 1.25, 0);
  controls.update();
  if (mode === 'apartment') setMode('building');
  fitScene();
}

function fitScene(view = 'orbit') {
  if (!camera || !controls) return;
  const g = mode === 'apartment' ? apartmentGroup : buildingGroup;
  if (!g) return;
  const bounds = new THREE.Box3().setFromObject(g);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const v = THREE.MathUtils.degToRad(camera.fov);
  const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  const dist = size.length() / 2 / Math.sin(Math.min(v, h) / 2) * 1.15;
  const dirs = {
    orbit: [1, .55, 1.25],
    side: [1.2, .2, 0],
    rear: [0, .25, -1.2],
    front: [0, .3, 1.4],
    top: [0.01, 1.4, 0.01]
  };
  const dir = new THREE.Vector3(...(dirs[view] || dirs.orbit)).normalize().multiplyScalar(dist);
  camera.position.copy(center).add(dir);
  controls.target.copy(center);
  controls.maxDistance = Math.max(120, dist * 2.2);
  controls.update();
  setCameraActive(view === 'orbit' ? 'camera-orbit' : 'camera-' + view);
}

async function init() {
  try {
    const [three, orbit] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js')
    ]);
    THREE = three;
    OrbitControls = orbit.OrbitControls;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1525);
    scene.fog = new THREE.Fog(0x0a1525, 40, 95);

    camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
    camera.position.set(14, 10, 16);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    viewport.prepend(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .07;
    controls.maxPolarAngle = Math.PI * .49;
    controls.minDistance = 7;
    controls.maxDistance = 55;

    scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x293348, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(14, 26, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 80;
    key.shadow.camera.left = -25;
    key.shadow.camera.right = 25;
    key.shadow.camera.top = 30;
    key.shadow.camera.bottom = -10;
    scene.add(key);
    const fill = new THREE.PointLight(0x00cfff, 22, 50);
    fill.position.set(-12, 10, -8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd8a0, 0.7);
    rim.position.set(-8, 12, -15);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      material('ground', 0x14233a, .96)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.3;
    ground.receiveShadow = true;
    scene.add(ground);

    buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    floorGroups = [];
    floorPickMeshes = [];
    floorCount = Number($('#floor-count').value);
    for (let i = 0; i < floorCount; i++) addBuildingFloor(i);
    box(buildingGroup, 8.6, .3, 7.5, 0, floorCount * FLOOR_H, 0, material('roof', 0x263b54, .5));
    box(buildingGroup, 9.2, .7, 8.2, 0, -.2, 0, material('podium', 0x607286, .75));
    box(buildingGroup, 3.2, .12, 2.2, 0, 2.6, 4.2, material('dark', 0x24374e, .55));

    makeNeighborhood();
    makeApartment();
    updateFloorOpacity();
    buildRoomList();
    updateFloorButtons();
    controls.target.set(0, floorCount * 1.25, 0);
    fitScene();

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', e => {
      pointerDownPos = [e.clientX, e.clientY];
      isDragging = false;
    });
    canvas.addEventListener('pointermove', e => {
      if (pointerDownPos) {
        const dx = e.clientX - pointerDownPos[0];
        const dy = e.clientY - pointerDownPos[1];
        if (Math.hypot(dx, dy) > 6) isDragging = true;
      }
      onPointerMove(e);
    });
    canvas.addEventListener('pointerup', e => {
      if (pointerDownPos && !isDragging && Math.hypot(e.clientX - pointerDownPos[0], e.clientY - pointerDownPos[1]) < 8) {
        onSceneClick(e);
      }
      pointerDownPos = null;
      isDragging = false;
    });
    canvas.addEventListener('pointerleave', () => {
      if (mode === 'building' && hoveredFloor >= 0) {
        hoveredFloor = -1;
        updateFloorOpacity();
      }
    });

    resize();
    window.addEventListener('resize', resize);
    loading.classList.add('hidden');

    $('#floor-count').addEventListener('change', () => {
      floorCount = Number($('#floor-count').value);
      rebuildFloors();
    });
    $('#open-apartment').addEventListener('click', () => setMode('apartment'));
    $('#show-all').onclick = () => {
      selectedFloor = -1;
      hoveredFloor = -1;
      setMode('building');
      updateFloorOpacity();
      fitScene();
    };
    $('#camera-orbit').onclick = () => fitScene('orbit');
    $('#camera-front').onclick = () => fitScene('front');
    $('#camera-side').onclick = () => fitScene('side');
    $('#camera-rear').onclick = () => fitScene('rear');
    $('#camera-top').onclick = () => fitScene('top');
    $('#reset-camera').onclick = () => fitScene();
    $('#view-structure').onclick = () => {
      if (mode !== 'apartment') return;
      const active = $('#view-structure').classList.toggle('active');
      apartmentGroup.children.forEach(o => {
        if (o.isLight) return;
        o.visible = !active || o.userData.structural;
      });
    };
    $('#back-building').addEventListener('click', () => setMode('building'));
    $('#view-plan').addEventListener('click', () => {
      camera.position.set(0, 16, .01);
      controls.target.set(0, 0, 0);
      controls.update();
      setActive('view-plan');
    });
    $('#view-perspective').addEventListener('click', () => {
      camera.position.set(11, 9, 13);
      controls.target.set(0, 0, 0);
      controls.update();
      setActive('view-perspective');
    });
    $('#view-interior').addEventListener('click', () => {
      const r = selectedRoom || rooms[0];
      controls.minDistance = .3;
      camera.position.set(r.x, 1.55, r.z + .5);
      controls.target.set(r.x, 1.35, r.z - .6);
      controls.update();
      setActive('view-interior');
    });
    $('#toggle-walls').addEventListener('click', () => {
      transparentWalls = !transparentWalls;
      apartmentGroup.userData.walls.forEach(w => {
        w.material.transparent = transparentWalls;
        w.material.opacity = transparentWalls ? .22 : 1;
      });
      $('#toggle-walls').classList.toggle('active', transparentWalls);
    });

    animate();
  } catch (error) {
    console.error(error);
    loading.textContent = 'Não foi possível carregar o motor 3D. Verifique sua conexão com a internet e abra esta página por um servidor local (não diretamente pelo arquivo).';
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

init();
