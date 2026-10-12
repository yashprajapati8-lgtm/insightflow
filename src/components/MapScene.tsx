"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Html, Line } from "@react-three/drei";
import india from "@svg-maps/india";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { project, tint, indexToT, isHotspot, lensOf, type GeoModel, type Lens, type CityStat } from "@/lib/geo";
import type { Review } from "@/lib/types";

const S = 0.1; // svg px to world units
const CX = 306;
const CY = 348;
const toWorld = (x: number, y: number) => new THREE.Vector2((x - CX) * S, -(y - CY) * S);

type StateGeo = {
  id: string;
  shapes: THREE.Shape[];
  outlines: THREE.Vector3[][];
  center: THREE.Vector2;
  size: number;
};

function buildStates(): StateGeo[] {
  const loader = new SVGLoader();
  return (india as { locations: { id: string; path: string }[] }).locations.map((loc) => {
    const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${loc.path}"/></svg>`);
    const shapes: THREE.Shape[] = [];
    const outlines: THREE.Vector3[][] = [];
    const box = new THREE.Box2();
    for (const p of data.paths) {
      for (const sh of SVGLoader.createShapes(p)) {
        const { shape, holes } = sh.extractPoints(3);
        const pts = shape.map((v) => toWorld(v.x, v.y));
        if (pts.length < 3) continue;
        const ns = new THREE.Shape(pts);
        ns.holes = holes.map((h) => new THREE.Path(h.map((v) => toWorld(v.x, v.y))));
        shapes.push(ns);
        pts.forEach((v) => box.expandByPoint(v));
        outlines.push([...pts, pts[0]].map((v) => new THREE.Vector3(v.x, v.y, 1.002)));
      }
    }
    const size = box.getSize(new THREE.Vector2());
    return { id: loc.id, shapes, outlines, center: box.getCenter(new THREE.Vector2()), size: Math.max(size.x, size.y) };
  });
}

export type MapSceneProps = {
  geo: GeoModel;
  lens: Lens | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpenReview: (r: Review, city: CityStat, n: number) => void;
  dark: boolean;
};

export default function MapScene(props: MapSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [-24, -94, 84], fov: 32, near: 1, far: 600, up: [0, 0, 1] }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <Scene {...props} />
    </Canvas>
  );
}

function Scene({ geo, lens, selected, onSelect, onOpenReview, dark }: MapSceneProps) {
  const states = useMemo(buildStates, []);
  const controls = useRef<CameraControls>(null);
  const [hover, setHover] = useState<string | null>(null);
  const aspect = useThree((t) => t.size.width / Math.max(1, t.size.height));
  // Narrow screens need the camera further back so the whole country fits.
  const far = aspect < 1.05 ? Math.min(1.9, 1.08 / aspect) : 1;

  // Fly to the selected state, or back to the whole country.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.camera.up.set(0, 0, 1);
    c.updateCameraUp();
    const st = selected ? states.find((s) => s.id === selected) : null;
    if (st) {
      const d = Math.max(16, st.size * 1.7 + 10) * far;
      c.setLookAt(st.center.x - d * 0.2, st.center.y - d * 0.65, d * 1.15, st.center.x, st.center.y - d * 0.04, 1, true);
    } else {
      c.setLookAt(-3 - 21 * far, -15 - 79 * far, 84 * far, -3, -15, 0, true);
    }
  }, [selected, states, far]);

  const side = dark ? "#9aa0aa" : "#c3c7ce";
  const border = dark ? "#8b919b" : "#9aa1ab";

  return (
    <>
      <ambientLight intensity={dark ? 0.75 : 0.9} />
      <hemisphereLight args={["#ffffff", "#8a90a0", 0.45]} />
      <directionalLight
        position={[-30, -40, 90]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0005}
      />
      <mesh position={[0, 0, -0.01]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <shadowMaterial opacity={dark ? 0.55 : 0.22} />
      </mesh>

      {states.map((s) => {
        const { color, depth } = look(geo, s.id, lens);
        const st = geo.states[s.id];
        return (
          <StateMesh
            key={s.id}
            s={s}
            color={color}
            side={side}
            border={border}
            depth={depth}
            dim={!!selected && selected !== s.id}
            active={selected === s.id}
            hovered={hover === s.id}
            onOver={() => setHover(s.id)}
            onOut={() => setHover((h) => (h === s.id ? null : h))}
            onClick={() => onSelect(selected === s.id ? null : s.id)}
            label={hover === s.id && !selected ? (st ? `${st.name} · ${st.reports.toLocaleString("en-US")} reports` : s.id) : null}
          />
        );
      })}

      {selected && geo.states[selected] && (
        <CityDomes
          key={selected}
          cities={geo.states[selected].cities}
          lens={lens}
          top={look(geo, selected, lens).depth + 0.6}
          onOpen={onOpenReview}
        />
      )}

      <CameraControls
        ref={controls}
        makeDefault
        minDistance={10}
        maxDistance={150}
        maxPolarAngle={1.25}
        dollySpeed={0.6}
        smoothTime={0.45}
      />
    </>
  );
}

function look(geo: GeoModel, id: string, lens: Lens | null) {
  const st = geo.states[id];
  let color = "#f4f5f7";
  let lift = 0;
  if (st) {
    if (lens) {
      const hot = isHotspot(st, lens.id);
      const t = indexToT(st.index[lens.id]) * (hot ? 1 : 0.3);
      color = tint(lens.color, t);
      lift = hot ? t * 1.6 : 0;
    } else if (st.main) {
      const t = indexToT(st.main.index);
      color = tint(st.main.lens.color, Math.max(0.25, t));
      lift = t * 1.6;
    }
  }
  return { color, depth: 1 + lift };
}

function StateMesh({
  s,
  color,
  side,
  border,
  depth,
  dim,
  active,
  hovered,
  onOver,
  onOut,
  onClick,
  label,
}: {
  s: StateGeo;
  color: string;
  side: string;
  border: string;
  depth: number;
  dim: boolean;
  active: boolean;
  hovered: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
  label: string | null;
}) {
  const group = useRef<THREE.Group>(null);
  const geom = useMemo(() => new THREE.ExtrudeGeometry(s.shapes, { depth: 1, bevelEnabled: false, curveSegments: 2 }), [s]);
  const cap = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, transparent: true }), []);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, transparent: true }), []);
  const target = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, dt);
    const z = (active ? 0.6 : hovered ? 0.5 : 0) + (dim ? -0.2 : 0);
    g.position.z += (z - g.position.z) * k;
    g.scale.z += (depth * (dim ? 0.6 : 1) - g.scale.z) * k;
    target.set(dim ? "#eef0f3" : color);
    cap.color.lerp(target, k);
    target.set(side);
    wall.color.lerp(target, k);
    const op = dim ? 0.38 : 1;
    cap.opacity += (op - cap.opacity) * k;
    wall.opacity += (op - wall.opacity) * k;
    cap.emissive.set(hovered && !dim ? "#ffffff" : "#000000");
    cap.emissiveIntensity = hovered && !dim ? 0.08 : 0;
  });

  return (
    <group ref={group} scale={[1, 1, depth]}>
      <mesh
        geometry={geom}
        material={[cap, wall]}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          onOver();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onOut();
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      />
      {s.outlines.map((pts, i) => (
        <Line key={i} points={pts} color={border} lineWidth={0.7} dashed dashSize={0.35} gapSize={0.25} transparent opacity={dim ? 0.2 : 0.75} />
      ))}
      {label && (
        <Html position={[s.center.x, s.center.y, 1.2]} center style={{ pointerEvents: "none" }}>
          <div className="glass whitespace-nowrap rounded-xl px-3 py-1.5 text-[12px] font-semibold text-ink">{label}</div>
        </Html>
      )}
    </group>
  );
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const MAX_DOTS = 42;

/** Each city opens into a dome of dots. One dot is one kind of review there; its size is how many customers reported it. */
function CityDomes({
  cities,
  lens,
  top,
  onOpen,
}: {
  cities: CityStat[];
  lens: Lens | null;
  top: number;
  onOpen: (r: Review, city: CityStat, n: number) => void;
}) {
  const dots = useMemo(() => {
    const out: { pos: THREE.Vector3; r: number; color: string; review: Review; n: number; city: CityStat }[] = [];
    for (const c of cities) {
      const [px, py] = project(c.city.lat, c.city.lon);
      const base = toWorld(px, py);
      const list = c.reviews.slice(0, MAX_DOTS);
      const R = 0.35 + 0.13 * Math.sqrt(list.length);
      list.forEach(({ review, n }, i) => {
        const t = (i + 0.5) / list.length;
        const z = 1 - t;
        const rr = Math.sqrt(1 - z * z);
        const th = i * GOLDEN;
        const l = lensOf(review.analysis.issueId);
        const on = !lens || l?.id === lens.id;
        const color = l ? (on ? l.color : "#c9cdd4") : review.analysis.sentiment === "positive" ? "#e9edf2" : "#b8bec8";
        out.push({
          pos: new THREE.Vector3(base.x + R * rr * Math.cos(th), base.y + R * rr * Math.sin(th), top + 0.4 + R * z),
          r: Math.min(0.3, 0.06 + 0.04 * Math.sqrt(n)) * (on ? 1 : 0.55),
          color,
          review,
          n,
          city: c,
        });
      });
    }
    return out;
  }, [cities, lens, top]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  const grow = useRef(0);
  const [hover, setHover] = useState<number | null>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const im = mesh.current;
    if (!im) return;
    dots.forEach((d, i) => im.setColorAt(i, new THREE.Color(d.color)));
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [dots]);

  useFrame((_, dt) => {
    const im = mesh.current;
    if (!im) return;
    grow.current = Math.min(1, grow.current + dt * 1.4);
    const e = 1 - Math.pow(1 - grow.current, 3);
    dots.forEach((d, i) => {
      const s = d.r * e * (hover === i ? 1.35 : 1);
      p.set(d.pos.x, d.pos.y, top + (d.pos.z - top) * e);
      sc.set(s, s, s);
      m.compose(p, q, sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  });

  const h = hover !== null ? dots[hover] : null;

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, dots.length]}
        castShadow
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) setHover(e.instanceId);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId === undefined) return;
          const d = dots[e.instanceId];
          onOpen(d.review, d.city, d.n);
        }}
      >
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial roughness={0.35} metalness={0.05} />
      </instancedMesh>

      {cities.map((c) => {
        const [px, py] = project(c.city.lat, c.city.lon);
        const b = toWorld(px, py);
        const R = 0.35 + 0.13 * Math.sqrt(Math.min(MAX_DOTS, c.reviews.length));
        return (
          <Html key={c.city.id} position={[b.x, b.y, top + R + 0.8]} center style={{ pointerEvents: "none" }} zIndexRange={[20, 10]}>
            <div className="whitespace-nowrap rounded-lg bg-[var(--bg)]/80 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur">
              {c.city.name} · {c.reports.toLocaleString("en-US")}
            </div>
          </Html>
        );
      })}

      {h && (
        <Html position={h.pos} center style={{ pointerEvents: "none" }} zIndexRange={[60, 50]}>
          <div className="glass w-[260px] -translate-y-[calc(50%+18px)] rounded-xl p-3 text-[12px] leading-snug text-ink">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-ink-2">
              <span>{h.city.city.name}</span>
              <span className="font-semibold text-ink">{h.n.toLocaleString("en-US")} customers</span>
            </div>
            <p className="quote line-clamp-3">“{h.review.text}”</p>
            <div className="mt-1.5 text-[11px] text-ink-2">Click to open the reviews</div>
          </div>
        </Html>
      )}
    </group>
  );
}
