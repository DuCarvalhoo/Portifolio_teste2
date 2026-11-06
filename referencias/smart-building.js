const $ = (selector) => document.querySelector(selector);
const viewport = $('#building-viewport');
const loading = $('#scene-loading');
const rooms = [
  { id:'sala', name:'Sala de estar', area:'24 m²', x:-1.9, z:1.55, w:3.4, d:2.45, color:0x8ab4c7, description:'Ambiente social integrado, com área de estar, sofá, mesa de centro e conexão com a varanda.' },
  { id:'jantar', name:'Sala de jantar', area:'12 m²', x:1.75, z:1.55, w:2.7, d:2.45, color:0xc7a37c, description:'Espaço de refeições com mesa central e circulação para cozinha e sala.' },
  { id:'cozinha', name:'Cozinha', area:'11 m²', x:2.05, z:-1.15, w:2.4, d:2.4, color:0xa9c6ac, description:'Cozinha com bancada, pia, armários, fogão e geladeira.' },
  { id:'suite', name:'Suíte', area:'16 m²', x:-2.05, z:-1.25, w:3.2, d:2.7, color:0xb5a0ca, description:'Quarto principal com cama de casal, criados-mudos e armário. Possui banheiro privativo demonstrativo.' },
  { id:'quarto', name:'Quarto 02', area:'10 m²', x:0.5, z:-3.6, w:2.3, d:1.35, color:0xc1b18e, description:'Quarto secundário com cama, armário e espaço de estudo.' },
  { id:'banho', name:'Banheiro social', area:'4 m²', x:2.9, z:-3.6, w:1.7, d:1.35, color:0x91b9c7, description:'Banheiro com bancada, lavatório, vaso sanitário e área de banho.' },
  { id:'servico', name:'Área de serviço', area:'5 m²', x:3.25, z:-2.0, w:1.2, d:1.2, color:0x9caa9f, description:'Espaço funcional com tanque, máquina de lavar e armários de apoio.' },
  { id:'varanda', name:'Varanda', area:'8 m²', x:-1.6, z:3.45, w:3.7, d:1.25, color:0x85b8bc, description:'Varanda frontal com guarda-corpo e espaço para duas poltronas.' }
];
let THREE, OrbitControls, renderer, scene, camera, controls, raycaster, pointer;
let buildingGroup, apartmentGroup, floorGroups = [], roomMeshes = [], selectedFloor = 0, floorCount = 8;
let mode = 'building', cameraMode = 'orbit', selectedRoom = null, transparentWalls = false;
const mats = {};
function material(name,color,roughness=.7,metalness=.05){return mats[name] ||= new THREE.MeshStandardMaterial({color,roughness,metalness});}
function box(parent,w,h,d,x,y,z,mat,opts={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone());
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  if(opts.name) mesh.name=opts.name;
  if(opts.room){mesh.userData.room=opts.room;roomMeshes.push(mesh);}
  parent.add(mesh); return mesh;
}
function addBuildingFloor(index){
  const g=new THREE.Group(); g.position.y=index*2.72;
  const slab=material('slab',0x9aa8b7,.85).clone(); const wall=material('wall',0xe0e6e9,.75).clone(); const glass= new THREE.MeshPhysicalMaterial({color:0x5ec9dd,roughness:.14,metalness:.12,transparent:true,opacity:.56,transmission:.14});
  const dark=material('dark',0x24374e,.55).clone(); const balcony=material('balcony',0x74879a,.65).clone();
  box(g,8.3,.22,7.2,0,0,0,slab);
  // Exterior envelope: rear and side walls; front is glazed to reveal the floor.
  box(g,8.1,2.45,.18,0,1.25,-3.48,wall);
  box(g,.18,2.45,7, -4.02,1.25,0,wall);
  box(g,.18,2.45,7, 4.02,1.25,0,wall);
  box(g,8.1,.16,.18,0,2.46,3.48,dark);
  for(let i=0;i<4;i++) box(g,1.55,1.75,.09,-2.9+i*1.92,1.3,3.43,glass);
  // Single balcony for the entire apartment on this floor.
  box(g,5.9,.16,1.45,0,.16,4.22,balcony);
  box(g,5.9,.82,.08,0,.62,4.92,glass);
  for(let x=-2.8;x<=2.81;x+=.55) box(g,.035,.82,.07,x,.62,4.92,dark);
  // Vertical structure and subtle floor lines.
  for(const x of [-4.05,4.05]) for(const z of [-3.5,3.5]) box(g,.24,2.68,.24,x,1.32,z,dark);
  g.userData.floor=index+1; buildingGroup.add(g); floorGroups.push(g);
}
function makeApartment(){
  apartmentGroup=new THREE.Group();
  const floorMat=material('aptfloor',0xb9a997,.9); const wallMat=new THREE.MeshStandardMaterial({color:0xe8e4dc,roughness:.88,transparent:false,opacity:1});
  box(apartmentGroup,8,.16,8,0,0,0,floorMat);
  const roomFloorMat={};
  rooms.forEach(r=>{
    const m=new THREE.MeshStandardMaterial({color:r.color,roughness:.9,transparent:true,opacity:.88,side:THREE.DoubleSide});
    const floor=box(apartmentGroup,r.w,.04,r.d,r.x,.11,r.z,m,{name:r.name,room:r});
    floor.userData.room=r; roomFloorMat[r.id]=m;
  });
  // Perimeter and partial interior walls keep the overhead plan readable.
  const wallMat2=wallMat;
  const walls=[];
  walls.push(box(apartmentGroup,8,.95,.14,0,.55,-3.92,wallMat2));
  walls.push(box(apartmentGroup,.14,.95,8,-3.92,.55,0,wallMat2));
  walls.push(box(apartmentGroup,.14,.95,8,3.92,.55,0,wallMat2));
  walls.push(box(apartmentGroup,2.9,.85,.12,-2.55,.5,0,wallMat2));
  walls.push(box(apartmentGroup,2.4,.85,.12,1.9,.5,-.05,wallMat2));
  walls.push(box(apartmentGroup,.12,.85,2.2,.2,.5,-2.9,wallMat2));
  walls.push(box(apartmentGroup,2.3,.85,.12,2.5,.5,-2.8,wallMat2));
  apartmentGroup.userData.walls=walls;
  // Sofa and coffee table, in the living room.
  const fabric=material('fabric',0x425b76), wood=material('wood',0x805b42), cream=material('cream',0xd2c7b7), metal=material('metal',0x9aa7b2,.35,.6);
  box(apartmentGroup,1.8,.48,.72,-2.4,.42,1.45,fabric); box(apartmentGroup,1.8,.58,.16,-2.4,.7,1.82,fabric);
  box(apartmentGroup,.9,.16,.55,-1.25,.18,1.5,wood); box(apartmentGroup,.75,.04,.4,-1.25,.28,1.5,cream);
  // Dining table and chairs.
  box(apartmentGroup,1.35,.12,.85,1.65,.78,1.5,wood);
  for(const x of [1.15,2.15]) for(const z of [1.05,1.95]) {box(apartmentGroup,.35,.1,.35,x,.42,z,fabric);box(apartmentGroup,.35,.48,.08,x,.66,z+.14,fabric);}
  // Kitchen counter, sink, hob, fridge.
  box(apartmentGroup,2.15,.85,.55,2.6,.55,-1.5,cream); box(apartmentGroup,2.2,.07,.58,2.6,1.0,-1.5,material('counter',0x65717b,.35));
  box(apartmentGroup,.65,1.7,.7,3.35,.9,-2.5,material('fridge',0xdfe8ed,.25,.15));
  box(apartmentGroup,.45,.05,.32,2.0,1.05,-1.5,metal);
  // Bedroom beds and wardrobes.
  const bed=material('bed',0x697c9f), pillow=material('pillow',0xe9e6df);
  box(apartmentGroup,1.6,.32,2,-2.2,.28,-1.2,bed); box(apartmentGroup,1.6,.12,.48,-2.2,.48,-1.85,pillow);
  box(apartmentGroup,.6,1.85,.55,-3.35,.95,-2.8,wood);
  box(apartmentGroup,1.25,.3,1.7,.35,.25,-3.45,bed); box(apartmentGroup,1.25,.1,.4,.35,.45,-4.0,pillow);
  // Bathroom fixtures and laundry.
  const porcelain=material('porcelain',0xf0f3f3,.2); box(apartmentGroup,.65,.42,.65,2.85,.32,-3.35,porcelain); box(apartmentGroup,.48,.7,.48,3.28,.35,-3.65,porcelain);
  box(apartmentGroup,.6,.9,.5,3.35,.48,-2.05,material('washer',0xd5dde0,.3));
  // Balcony chairs and plants.
  box(apartmentGroup,.52,.35,.52,-2.75,.29,3.35,wood); box(apartmentGroup,.52,.35,.52,-1.95,.29,3.35,wood);
  const green=material('plant',0x4b8a65); box(apartmentGroup,.45,.55,.45,2.6,.35,3.45,green);
  apartmentGroup.userData.roomFloors=roomFloorMat; scene.add(apartmentGroup); apartmentGroup.visible=false;
}
function updateFloorOpacity(){
  floorGroups.forEach((g,i)=>{
    const selected=i===selectedFloor;
    g.position.y=i*2.72+(selected && mode==='building'?0.5:0);
    g.traverse(o=>{if(o.isMesh && o.material){if(o.userData.baseOpacity===undefined){o.userData.baseOpacity=o.material.opacity;o.userData.baseTransparent=o.material.transparent;}o.material.transparent=selected?o.userData.baseTransparent:true;o.material.opacity=selected?o.userData.baseOpacity:.17;}});
  });
}
function setMode(next){
  mode=next; buildingGroup.visible=next==='building'; apartmentGroup.visible=next==='apartment';
  $('#scene-title').textContent=next==='building'?'Edifício residencial · visão externa':'Apartamento '+String(selectedFloor+1).padStart(2,'0')+' · unidade única do pavimento';
  $('#scene-subtitle').textContent=next==='building'?'Arraste para orbitar · scroll ou pinça para zoom':'Clique nos ambientes para consultar suas características';
  $('#back-building').classList.toggle('hidden',next==='building');
  ['view-plan','view-perspective','view-interior','toggle-walls'].forEach(id=>$('#'+id).disabled=next==='building');
  if(next==='apartment'){
    camera.position.set(0,13,9); controls.target.set(0,0,0); controls.update();
    $('#room-title').textContent='Planta do apartamento';
    $('#room-description').textContent='Uma unidade residencial por pavimento, com ambientes e mobiliário demonstrativos. Selecione um cômodo na cena ou na lista.';
  } else {
    camera.position.set(13,10,16); controls.target.set(0,8,0); controls.update();
    $('#room-title').textContent='Conheça o apartamento';
    $('#room-description').textContent='O edifício possui exatamente um apartamento por andar. Selecione um pavimento e explore a unidade.';
  }
  updateFloorButtons();
}
function updateFloorButtons(){
  const boxEl=$('#floor-selector'); boxEl.replaceChildren();
  for(let i=floorCount;i>=1;i--){const b=document.createElement('button');b.className='floor-btn'+(i-1===selectedFloor?' active':'');b.textContent=`${i}º`;b.addEventListener('click',()=>selectFloor(i-1));boxEl.append(b);}
  $('#unit-total').textContent=String(floorCount).padStart(2,'0');
}
function selectFloor(index){
  selectedFloor=Math.max(0,Math.min(floorCount-1,index)); updateFloorOpacity(); updateFloorButtons();
  $('#scene-title').textContent=`Pavimento ${selectedFloor+1} selecionado · 01 apartamento`;
  $('#room-title').textContent=`${selectedFloor+1}º pavimento`;
  $('#room-description').textContent=`Unidade residencial ${String(selectedFloor+1).padStart(2,'0')}: um único apartamento neste andar. Abra a unidade para explorar os ambientes.`;
}
function selectRoom(room){
  selectedRoom=room; roomMeshes.forEach(m=>{const c=m.userData.room; m.material.color.setHex(c.id===room.id?0xff606a:c.color);});
  $('#room-title').textContent=room.name+' · '+room.area; $('#room-description').textContent=room.description;
  document.querySelectorAll('.room-btn').forEach(b=>b.classList.toggle('active',b.dataset.room===room.id));
}
function buildRoomList(){
  const list=$('#room-list');list.replaceChildren();
  rooms.forEach(room=>{const b=document.createElement('button');b.className='room-btn';b.dataset.room=room.id;b.innerHTML=`<span>${room.name}</span><small>${room.area}</small>`;b.addEventListener('click',()=>{if(mode!=='apartment')setMode('apartment');selectRoom(room);});list.append(b);});
}
function resize(){if(!renderer)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));}
async function init(){
  try{
    const [three,orbit]=await Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'),import('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js')]);
    THREE=three;OrbitControls=orbit.OrbitControls;
    scene=new THREE.Scene();scene.background=new THREE.Color(0x071020);scene.fog=new THREE.Fog(0x071020,35,80);
    camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(13,10,16);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;viewport.prepend(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=7;controls.maxDistance=42;
    scene.add(new THREE.HemisphereLight(0xc8e8ff,0x293348,2.1));const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(12,22,12);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);const fill=new THREE.PointLight(0x00cfff,25,45);fill.position.set(-10,9,-8);scene.add(fill);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material('ground',0x14233a,.96));ground.rotation.x=-Math.PI/2;ground.position.y=-.3;ground.receiveShadow=true;scene.add(ground);const grid=new THREE.GridHelper(60,30,0x356080,0x203851);grid.position.y=-.28;scene.add(grid);
    buildingGroup=new THREE.Group();scene.add(buildingGroup);floorGroups=[];floorCount=Number($('#floor-count').value);
    for(let i=0;i<floorCount;i++)addBuildingFloor(i);
    controls.target.set(0,floorCount*1.25,0);
    // Roof volume and entrance podium.
    box(buildingGroup,8.5,.28,7.4,0,floorCount*2.72,0,material('roof',0x263b54,.5));
    box(buildingGroup,9,.65,8,0,-.15,0,material('podium',0x607286,.75));
    makeApartment();updateFloorOpacity();buildRoomList();updateFloorButtons();selectFloor(floorCount-1);
    raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();renderer.domElement.addEventListener('pointerup',onSceneClick);
    resize();window.addEventListener('resize',resize);loading.classList.add('hidden');
    $('#floor-count').addEventListener('change',()=>{floorCount=Number($('#floor-count').value);rebuildFloors();});
    $('#open-apartment').addEventListener('click',()=>setMode('apartment'));
    $('#back-building').addEventListener('click',()=>setMode('building'));
    $('#view-plan').addEventListener('click',()=>{camera.position.set(0,13,9);controls.target.set(0,0,0);controls.update();setActive('view-plan');});
    $('#view-perspective').addEventListener('click',()=>{camera.position.set(12,10,14);controls.target.set(0,0,0);controls.update();setActive('view-perspective');});
    $('#view-interior').addEventListener('click',()=>{camera.position.set(0,5,8);controls.target.set(0,.4,0);controls.update();setActive('view-interior');});
    $('#toggle-walls').addEventListener('click',()=>{transparentWalls=!transparentWalls;apartmentGroup.userData.walls.forEach(w=>{w.material.transparent=transparentWalls;w.material.opacity=transparentWalls?.2:1;});$('#toggle-walls').classList.toggle('active',transparentWalls);});
    $('#camera-orbit').addEventListener('click',()=>{cameraMode='orbit';camera.position.set(13,10,16);controls.target.set(0,floorCount*1.25,0);controls.update();setCameraActive('camera-orbit');});
    $('#camera-front').addEventListener('click',()=>{cameraMode='front';camera.position.set(0,floorCount*1.35,27);controls.target.set(0,floorCount*1.3,0);controls.update();setCameraActive('camera-front');});
    $('#camera-top').addEventListener('click',()=>{cameraMode='top';camera.position.set(0,floorCount*2.72+15,0.01);controls.target.set(0,floorCount*1.2,0);controls.update();setCameraActive('camera-top');});
    $('#reset-camera').addEventListener('click',()=>{camera.position.set(13,10,16);controls.target.set(0,floorCount*1.25,0);controls.update();});
    animate();
  }catch(error){console.error(error);loading.textContent='Não foi possível carregar o motor 3D. Verifique sua conexão com a internet e abra esta página por um servidor local (não diretamente pelo arquivo).';}
}
function setActive(id){['view-plan','view-perspective','view-interior'].forEach(k=>$('#'+k).classList.toggle('active',k===id));}
function setCameraActive(id){['camera-orbit','camera-front','camera-top'].forEach(k=>$('#'+k).classList.toggle('active',k===id));}
function rebuildFloors(){
  buildingGroup.clear();floorGroups=[];floorCount=Number($('#floor-count').value);
  for(let i=0;i<floorCount;i++)addBuildingFloor(i);
  box(buildingGroup,8.5,.28,7.4,0,floorCount*2.72,0,material('roof',0x263b54,.5));box(buildingGroup,9,.65,8,0,-.15,0,material('podium',0x607286,.75));
  selectedFloor=Math.min(selectedFloor,floorCount-1);updateFloorOpacity();updateFloorButtons();selectFloor(selectedFloor);
  controls.target.set(0,floorCount*1.25,0);controls.update();if(mode==='apartment')setMode('building');
}
function onSceneClick(event){
  if(mode!=='apartment')return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(roomMeshes,false);if(hits.length&&hits[0].object.userData.room)selectRoom(hits[0].object.userData.room);
}
function animate(){requestAnimationFrame(animate);if(controls)controls.update();if(renderer&&scene&&camera)renderer.render(scene,camera);}
init();
