import React, { useState, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import './index.css';

const MU = 0.5;

// Orbital reference rings - visual guides showing inclination planes
function OrbitalRings() {
  const planes = [
    { inclination: 0, radius: 3.5, color: '#fbbf24', opacity: 0.25, name: 'Equatorial' },
    { inclination: 51.6, radius: 3.9, color: '#60a5fa', opacity: 0.25, name: 'ISS Orbit' },
    { inclination: 63.4, radius: 4.1, color: '#a78bfa', opacity: 0.25, name: 'Molniya' },
    { inclination: 90, radius: 4.3, color: '#f472b6', opacity: 0.25, name: 'Polar' },
    { inclination: 98, radius: 4.7, color: '#34d399', opacity: 0.25, name: 'Sun-Sync' }
  ];

  return (
    <>
      {planes.map((plane, idx) => {
        const inclRad = (plane.inclination * Math.PI) / 180;
        return (
          <mesh key={idx} rotation={[inclRad, 0, 0]}>
            <torusGeometry args={[plane.radius, 0.04, 32, 256]} />
            <meshBasicMaterial color={plane.color} transparent opacity={plane.opacity} wireframe={false} />
          </mesh>
        );
      })}
    </>
  );
}

// Optimized debris cloud renderer
function DebrisCloud({ debrisList, targetedId, onCollectDebris }) {
  const meshRef = useRef();
  const stateRef = useRef(new Map());

  // Initialize debris states
  useMemo(() => {
    debrisList.forEach(debris => {
      if (!stateRef.current.has(debris.id)) {
        stateRef.current.set(debris.id, {
          angle: debris.initialAngle,
          radius: debris.initialRadius
        });
      }
    });
  }, [debrisList]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const posAttr = meshRef.current.geometry.attributes.position;
    const colAttr = meshRef.current.geometry.attributes.color;

    debrisList.forEach((debris, idx) => {
      const state = stateRef.current.get(debris.id);
      if (!state) return;

      const angVel = Math.sqrt(MU / Math.pow(state.radius, 3)) * debris.speedMultiplier;
      state.angle += angVel * delta;

      const x = state.radius * Math.cos(state.angle);
      const z = state.radius * Math.sin(state.angle);
      const y = x * Math.sin(debris.inclination);

      posAttr.setXYZ(idx, x, y, z);

      const col = new THREE.Color(debris.id === targetedId ? '#ef4444' : debris.color);
      colAttr.setXYZ(idx, col.r, col.g, col.b);
    });

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(debrisList.length * 3);
    const colors = new Float32Array(debrisList.length * 3);

    debrisList.forEach((debris, i) => {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const col = new THREE.Color(debris.color);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    });

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [debrisList]);

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial size={0.05} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

// Generate realistic debris with proper orbital inclination planes
function generateRealisticDebris() {
  // Define realistic orbital inclination bands with colors
  const orbitalPlanes = [
    { name: 'Equatorial', inclination: 0, spread: 5, percentage: 0.12, color: '#fbbf24' },           // Yellow
    { name: 'Sun-Synchronous', inclination: 98, spread: 3, percentage: 0.22, color: '#34d399' },    // Green
    { name: 'ISS Orbit', inclination: 51.6, spread: 5, percentage: 0.18, color: '#60a5fa' },        // Blue
    { name: 'Molniya', inclination: 63.4, spread: 4, percentage: 0.10, color: '#a78bfa' },          // Purple
    { name: 'Polar', inclination: 90, spread: 8, percentage: 0.25, color: '#f472b6' },              // Pink
    { name: 'Scattered Debris', inclination: 45, spread: 45, percentage: 0.13, color: '#ea580c' }   // Orange
  ];

  // Realistic LEO altitude bands
  const orbitalBands = [
    { minR: 3.2, maxR: 3.8, density: 0.30, activeRatio: 0.25 },   // Low LEO
    { minR: 3.8, maxR: 4.2, density: 0.25, activeRatio: 0.20 },   // Mid LEO
    { minR: 4.2, maxR: 5.0, density: 0.22, activeRatio: 0.18 },   // Higher LEO
    { minR: 5.0, maxR: 6.5, density: 0.15, activeRatio: 0.15 },   // Outer LEO
    { minR: 6.5, maxR: 8.0, density: 0.08, activeRatio: 0.22 }    // GEO region
  ];

  const debris = [];
  let id = 0;

  orbitalBands.forEach(band => {
    const totalCount = Math.round(6200 * band.density);
    const activeCount = Math.round(totalCount * band.activeRatio);
    const inactiveCount = totalCount - activeCount;

    // Generate debris distributed across orbital planes
    orbitalPlanes.forEach(plane => {
      const planeActiveCount = Math.round(activeCount * plane.percentage);
      const planeInactiveCount = Math.round(inactiveCount * plane.percentage);

      // Active satellites in this plane
      for (let i = 0; i < planeActiveCount; i++) {
        const inclDegrees = plane.inclination + (Math.random() - 0.5) * plane.spread * 2;
        debris.push({
          id: id++,
          name: `${plane.name} Sat #${10000 + id}`,
          initialRadius: band.minR + Math.random() * (band.maxR - band.minR),
          inclination: (inclDegrees * Math.PI) / 180,
          initialAngle: Math.random() * Math.PI * 2,
          speedMultiplier: 0.2 + Math.random() * 0.8,
          color: plane.color,
          velocity: (Math.sqrt(MU / (band.minR + (band.maxR - band.minR) / 2)) * 7.8).toFixed(2),
          type: 'Active Satellite',
          orbitalPlane: plane.name,
          isActive: true
        });
      }

      // Inactive debris in this plane
      for (let i = 0; i < planeInactiveCount; i++) {
        const inclDegrees = plane.inclination + (Math.random() - 0.5) * plane.spread * 2;
        debris.push({
          id: id++,
          name: `${plane.name} Debris #${10000 + id}`,
          initialRadius: band.minR + Math.random() * (band.maxR - band.minR),
          inclination: (inclDegrees * Math.PI) / 180,
          initialAngle: Math.random() * Math.PI * 2,
          speedMultiplier: 0.2 + Math.random() * 0.8,
          color: plane.color,
          velocity: (Math.sqrt(MU / (band.minR + (band.maxR - band.minR) / 2)) * 7.8).toFixed(2),
          type: 'Debris Fragment',
          orbitalPlane: plane.name,
          isActive: false
        });
      }
    });
  });

  return debris;
}

// Main Simulation Scene Setup
function SimulationScene({ debrisList, targetedId, onCollectDebris }) {
  return (
    <Canvas camera={{ position: [0, 12, 18], fov: 55 }}>
      <color attach="background" args={['#000814']} />
      <ambientLight intensity={0.25} />
      <pointLight position={[25, 25, 25]} intensity={1.2} />
      <pointLight position={[-20, 15, -20]} intensity={0.6} color="#0ea5e9" />

      {/* Earth */}
      <mesh>
        <sphereGeometry args={[2.0, 80, 80]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[2.08, 40, 40]} />
        <meshBasicMaterial color="#0ea5e9" wireframe transparent opacity={0.15} />
      </mesh>

      {/* Outer halo */}
      <mesh>
        <sphereGeometry args={[2.15, 32, 32]} />
        <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.08} />
      </mesh>

      {/* Debris Cloud */}
      <DebrisCloud 
        debrisList={debrisList} 
        targetedId={targetedId}
        onCollectDebris={onCollectDebris}
      />

      {/* Orbital reference rings */}
      <OrbitalRings />

      <Stars radius={250} depth={120} count={6000} factor={8} saturation={0.7} fade speed={1.0} />
      <OrbitControls enablePan={true} enableZoom={true} maxDistance={60} minDistance={6} />
    </Canvas>
  );
}

// Master Dashboard Wrapper Control Layout
function App() {
  const initialDebris = useMemo(() => {
    const all = generateRealisticDebris();
    // Filter to only show inactive debris
    return all.filter(d => !d.isActive);
  }, []);

  const [debrisList, setDebrisList] = useState(initialDebris);
  const [targetedId, setTargetedId] = useState(null);
  const [collectedCount, setCollectedCount] = useState(0);

  // Calculate debris count by orbital plane
  const planeStats = useMemo(() => {
    const stats = {};
    debrisList.forEach(debris => {
      if (!stats[debris.orbitalPlane]) {
        stats[debris.orbitalPlane] = { count: 0, color: debris.color, active: 0, inactive: 0 };
      }
      stats[debris.orbitalPlane].count++;
      if (debris.isActive) stats[debris.orbitalPlane].active++;
      else stats[debris.orbitalPlane].inactive++;
    });
    return stats;
  }, [debrisList]);

  const targetedDebris = debrisList.find(d => d.id === targetedId);

  const handleCollectDebris = (id) => {
    setDebrisList(prev => prev.filter(item => item.id !== id));
    setCollectedCount(prev => prev + 1);
    if (targetedId === id) setTargetedId(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-slate-100 select-none">
      {/* 3D Canvas */}
      <div className="w-full h-full">
        <SimulationScene 
          debrisList={debrisList} 
          targetedId={targetedId} 
          onCollectDebris={handleCollectDebris} 
        />
      </div>

      {/* Header */}
          <header className="absolute top-0 left-0 p-6 pointer-events-none z-10 w-full">
            <div>
              <h1 className="text-4xl font-playfair font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 uppercase">
                Orbital Debris Monitor
              </h1>
              <p className="text-xs text-amber-200/60 font-mono tracking-tight mt-2">
                Real-time debris analysis and tracking in low earth orbit
              </p>
            </div>
          </header>

      {/* Left Sidebar */}
      <section className="absolute bottom-6 left-6 w-96 bg-amber-950/40 backdrop-blur border border-amber-700/30 rounded-lg p-5 flex flex-col gap-4 z-10">
        <div>
          <h2 className="text-sm font-playfair font-bold uppercase text-amber-200 tracking-wider border-b border-amber-700/30 pb-3">
            Debris Statistics
          </h2>
          
          <div className="bg-amber-950/60 p-4 border border-amber-700/40 rounded font-mono mt-4">
            <span className="text-[10px] text-amber-200/60 block uppercase tracking-wider">Debris Tracked</span>
            <span className="text-4xl font-bold text-amber-400">{debrisList.length.toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-amber-700/30 pt-3">
          <span className="text-[11px] font-playfair font-bold uppercase text-amber-200 tracking-wider block mb-3">
            Distribution by Orbital Plane
          </span>
          <div className="flex flex-col gap-2 text-[9px] font-mono max-h-48 overflow-y-auto custom-scrollbar">
            {Object.entries(planeStats).map(([plane, stats]) => (
              <div key={plane} className="bg-amber-950/50 p-2 rounded border border-amber-700/30 flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: stats.color}}></div>
                  <div>
                    <p className="text-amber-100 font-bold">{plane}</p>
                    <p className="text-amber-200/50 text-[8px]">
                      {stats.count.toLocaleString()} fragments
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right Sidebar - Target Lock */}
      {targetedDebris && (
        <section className="absolute bottom-6 right-6 w-80 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg p-5 z-10 animate-fade-in">
          <h2 className="text-xs font-bold font-mono uppercase text-red-400 tracking-wider border-b border-slate-800 pb-2 flex justify-between">
            <span>⚠️ Object Target Lock</span>
            <button onClick={() => setTargetedId(null)} className="text-slate-500 hover:text-slate-300 text-[10px]">✕ CLEAR</button>
          </h2>
          <div className="mt-3 font-mono text-xs flex flex-col gap-2">
            <p><span className="text-slate-500">Type:</span> <span className="text-slate-200">{targetedDebris.type}</span></p>
            <p><span className="text-slate-500">Orbit Distance:</span> <span className="text-cyan-400">{(targetedDebris.initialRadius * 6371).toFixed(0)} km</span></p>
            <p><span className="text-slate-500">Rel Velocity:</span> <span className="text-amber-400">{targetedDebris.velocity} km/s</span></p>
            
            <button 
              onClick={() => handleCollectDebris(targetedDebris.id)}
              className="mt-3 w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold py-2 px-4 rounded font-sans uppercase text-xs tracking-wider transition-all"
            >
              Deploy Recovery Net System
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);