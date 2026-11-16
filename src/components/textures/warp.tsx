// Warp — a Texture by Textures · https://textures.dev/s/warp
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
/* eslint-disable prefer-const -- arquivo de terceiros (textures.dev), mantido como veio */
"use client"
import { type CSSProperties, useEffect, useRef, useState } from "react"
function selfSize(root: HTMLElement | null): void {
	const host = root?.parentElement
	if (!root || !host || host.getBoundingClientRect().height > 0) return
	root.style.minHeight = "240px"
}
const ASPECT = 0.7053
const MIN_BOX: [number, number] = [160, 113]
type El = { id: string; role: string; d: string; cx: number; cy: number; ny?: number }
const PACKED =
	"7ZRRCoJAFEXvBfvtJ5fRMvpwMbaDiGwLtTuXIDyXMCEU2JeEQzVwBDk8dR5zH3P0ydJGsl0BAAAAAACQDYO2umq6Wp2TFL6neT2urKPw9Uv9mr4288sxv+Pz/S3N63FlHYWvX+rH+cNf/MVfzh/zw99f+Ltjfvz/8Bd/8Rd/8Rd/8Rd/OX/4+5U8ex8Unr57v+PD+vWs6S/O26/zf++PvOQlL3nLyPsA"
type Geometry = { elements: El[]; plates: string[] }
let pending: Promise<Geometry> | null = null
async function unpack(): Promise<Geometry> {
	const bytes = Uint8Array.from(atob(PACKED), (c) => c.charCodeAt(0))
	const v = new DataView(
		await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer(),
	)
	let o = 0
	const u8 = () => v.getUint8(o++)
	const u16 = () => ((o += 2), v.getUint16(o - 2, true))
	const i16 = () => ((o += 2), v.getInt16(o - 2, true))
	u8()
	const ne = u16()
	const ops = Array.from({ length: ne + u16() }, () => Array.from({ length: u16() }, u8))
	let x = 0
	let y = 0
	const pt = () => `${(x += i16()) / 10000} ${(y += i16()) / 10000}`
	const paths = ops.map((a) =>
		a
			.map(
				(c) =>
					["M", "L", "Q", "A", "Z"][c] +
					(c === 2
						? `${pt()} ${pt()}`
						: c === 3
							? `${i16() / 10000} ${i16() / 10000} ${i16() / 10} ${i16()} ${i16()} ${pt()}`
							: c === 4
								? ""
								: pt()),
			)
			.join(""),
	)
	let cx = 0
	let cy = 0
	const elements = paths
		.slice(0, ne)
		.map((d, i): El => ({ id: String(i), role: "motif", d, cx: (cx += i16()) / 10000, cy: (cy += i16()) / 10000 }))
	return { elements, plates: paths.slice(ne) }
}
function useGeometry(): Geometry | null {
	const [geometry, setGeometry] = useState<Geometry | null>(null)
	useEffect(() => {
		let live = true
		void (pending ??= unpack()).then((g) => live && setGeometry(g))
		return () => {
			live = false
		}
	}, [])
	return geometry
}
type React_ = {
	target: string
	property: "translate" | "scale" | "rotate" | "opacity"
	along?: "normal" | "tangent" | "toward" | "away" | "x" | "y"
	max: number
	map?: "falloff" | "inverse-falloff" | "constant"
}
type Spec = {
	ir?: 1
	behavior?: "displace" | "clear" | "glow"
	rest?: "static"
	pointer: {
		falloff: {
			shape?: "radial" | "directional"
			radius?: number
			curve?: Curve
		}
	}
	react: React_[]
	stagger?: { by?: "distance" | "index" | "none"; ms?: number }
	leave: {
		settle: "spring" | "ease"
		spring?: { stiffness: number; damping: number }
	}
	reducedMotion: "none" | "static" | "simplified"
	a11y?: {
		keyboard?: "center-pulse" | "center-hold" | "none"
		touch?: "ambient" | "tap-ripple" | "tap-toggle" | "static"
	}
}
type Target = { el: SVGGraphicsElement; role: string; index: number; cx: number; cy: number }
type Options = { spec: Spec; targets: Target[]; aspect: number; min?: [number, number] }
const AMBIENT_SPEED = 1.5
const AMBIENT_CYCLE = 4.5
const LEAVE_K = 900
const LEAVE_MS = 350
function mount(root: HTMLElement, o: Options): () => void {
	const svg = root.querySelector("svg")
	if (!svg) return () => {}
	const { spec } = o
	const fall = spec.pointer.falloff
	const rad0 = fall.radius ?? 0.35
	const curve = curves[fall.curve ?? "smoothstep"]
	const short = Math.min(1, o.aspect)
	const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(update: slow)").matches
	const reduced = () => spec.reducedMotion !== "none" && calm()
	const n = o.targets.length
	const C = spec.react.some((r) => r.property === "scale" && (r.along === "x" || r.along === "y")) ? 3 : 1
	const val = new Float32Array(n * C)
	const vel = new Float32Array(n * C)
	const along = (d: number) => {
		const q = Math.abs(d) / (rad0 * short)
		return q >= 1 ? 0 : curve(1 - q)
	}
	const amp = Math.max(1, ...spec.react.map((r) => Math.abs(r.max)))
	const rules = spec.react.map((r) => ({
		...r,
		idx: o.targets.map((t, i) => (r.target === "all" || t.role === r.target ? i : -1)).filter((i) => i >= 0),
	}))
	const mask = new Uint32Array(n)
	rules.forEach((r, ri) => {
		for (const i of r.idx) mask[i]! |= 1 << ri
	})
	const wholeField = false
	const wrote: string[] = new Array(n).fill("")
	for (const t of o.targets) {
		t.el.style.transformBox = "fill-box"
		t.el.style.transformOrigin = "center"
	}
	let box: DOMRect | null = null
	let px = 0.5
	let py = short / 2
	let act = 0
	let w = 0
	let wv = 0
	let t0 = 0
	let raf = 0
	let last = 0
	let seen = true
	let gone = 0
	const touchQ = matchMedia("(hover: none), (pointer: coarse)")
	const wantsAmb = () => {
		const forced = root.closest("[data-motion]")?.getAttribute("data-motion")
		return (spec.a11y?.touch ?? "ambient") === "ambient" && (forced ? forced === "ambient" : touchQ.matches)
	}
	const wAmb = (2 * Math.PI) / AMBIENT_CYCLE
	const ph = Math.random() * 2 * Math.PI
	let amb = false
	let clock = 0
	let hold = 0
	const fit = () => {
		const r = svg.getBoundingClientRect()
		box = r.width < (o.min?.[0] ?? 0) || r.height < (o.min?.[1] ?? 0) ? null : r
	}
	const toUnit = (x: number, y: number) => {
		if (!box) return
		px = (x - box.left) / box.width
		py = ((y - box.top) / box.height) * o.aspect
	}
	const tick = (now: number) => {
		const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 1 / 30)
		last = now
		const snap = reduced()
		if (amb && now > hold) {
			if (snap || calm()) act = 0
			else {
				clock += dt * AMBIENT_SPEED
				const t = clock
				px = 0.5 + 0.5 * (0.76 * Math.sin(wAmb * t + ph) + 0.2 * Math.sin(1.93 * wAmb * t + 1.2 + ph))
				py =
					(o.aspect / 2) *
					(1 + 0.72 * Math.sin(0.75 * wAmb * t + 0.8 + ph) + 0.2 * Math.sin(1.37 * wAmb * t + 2.1 + ph))
				if (!act) t0 = now
				gone = 0
				act = 1
			}
		}
		const st = spec.leave.spring ?? { stiffness: 260, damping: 28 }
		let busy = false
		if (snap) w = act
		else if (!act) [w, wv] = spring(w, wv, 0, LEAVE_K, 2 * Math.sqrt(LEAVE_K), dt)
		else [w, wv] = spring(w, wv, act, LEAVE_K, 2 * Math.sqrt(LEAVE_K), dt)
		const z = (v: number) => (Math.abs(v) < 1e-5 ? 0 : v)
		const rad = rad0 * short
		for (let i = 0; i < n; i++) {
			const t = o.targets[i]!
			let dx = px - t.cx
			let dy = py - t.cy
			const dist = Math.sqrt(dx * dx + dy * dy) / rad
			const outside = dist >= 1 && (C < 2 || (along(px - t.cx) === 0 && along(py - t.cy) === 0))
			if (outside) {
				let rest = true
				for (let c = 0; c < C; c++) {
					const k = i * C + c
					if (val[k] !== 0 || vel[k] !== 0) {
						rest = false
						break
					}
				}
				if (rest) continue
			}
			const on = act && now - t0 >= 0 ? w : 0
			const f0 = dist >= 1 ? 0 : curve(1 - dist)
			const f1 = C > 1 ? along(px - t.cx) : 0
			const f2 = C > 2 ? along(py - t.cy) : 0
			for (let c = 0; c < C; c++) {
				const k = i * C + c
				const goal = act ? (c === 0 ? f0 : c === 1 ? f1 : f2) * on : 0
				if (snap) val[k] = goal
				else if (!act) {
					const kk = Math.max(st.stiffness, LEAVE_K)
					;[val[k], vel[k]] = spring(val[k]!, vel[k]!, goal, kk, 2 * Math.sqrt(kk), dt) as [number, number]
				} else [val[k], vel[k]] = spring(val[k]!, vel[k]!, goal, st.stiffness, st.damping, dt) as [number, number]
				if (goal * amp < 0.005 && Math.abs(val[k]!) * amp < 0.005) {
					val[k] = 0
					vel[k] = 0
					continue
				}
				if ((Math.abs(val[k]! - goal) + Math.abs(vel[k]!) * dt) * amp > 1e-3) busy = true
				else if (Math.abs(val[k]!) * amp <= 1e-3 && !act) {
					val[k] = 0
					vel[k] = 0
				}
			}
			if (!wholeField) {
				let zero = true
				for (let c = 0; c < C; c++)
					if (val[i * C + c] !== 0) {
						zero = false
						break
					}
				if (zero && wrote[i] === "") continue
			}
			let sx = 1
			let sy = 1
			const m = mask[i]!
			for (let ri = 0; ri < rules.length; ri++) {
				if (!(m & (1 << ri))) continue
				const r = rules[ri]!
				const ch = r.property === "scale" ? (r.along === "x" ? 1 : r.along === "y" ? 2 : 0) : 0
				const amt = val[i * C + ch]! * r.max
				if (r.property === "scale") {
					if (ch !== 2) sx += amt
					if (ch !== 1) sy += amt
				}
			}
			const r3 = (v: number) => Math.round(v * 100) / 100
			const ssx = r3(1 + z(sx - 1))
			const ssy = r3(1 + z(sy - 1))
			const next = (ssx !== 1 || ssy !== 1 ? `scale(${ssx},${ssy})` : "") || "translate(0px,0px)"
			if (next !== wrote[i]) {
				t.el.style.transform = next
				wrote[i] = next
			}
		}
		if (Math.abs(w - act) * amp > 1e-3 || Math.abs(wv) * dt * amp > 1e-3) busy = true
		else if (act) {
			w = act
			wv = 0
		}
		if (!act && gone && now - gone > LEAVE_MS) busy = false
		raf = busy || (amb && !snap && !calm()) ? requestAnimationFrame(tick) : 0
		if (!raf) {
			if (act) last = 0
			else rest()
		}
	}
	function rest() {
		last = 0
		w = 0
		wv = 0
		val.fill(0)
		vel.fill(0)
		for (let i = 0; i < n; i++) {
			const t = o.targets[i]!
			if (wrote[i] !== "") t.el.style.transform = ""
			wrote[i] = ""
		}
	}
	const go = () => {
		if (!raf && (seen || hold > performance.now()) && box) raf = requestAnimationFrame(tick)
	}
	const enterAt = (x: number, y: number) => {
		if (timer) {
			clearTimeout(timer)
			timer = 0
		}
		fit()
		if (!box) return
		toUnit(x, y)
		if (!act) t0 = performance.now()
		gone = 0
		act = 1
		go()
	}
	let timer: ReturnType<typeof setTimeout> | 0 = 0
	const letGo = () => {
		if (act) gone = performance.now()
		act = 0
		go()
	}
	const leave = (e?: Event) => {
		if (e && isTouch(e as PointerEvent)) return
		if (e && !e.isTrusted) hold = 0
		if (amb && performance.now() > hold) return
		return letGo()
	}
	const isTouch = (e: PointerEvent) => e.pointerType === "touch" && touchQ.matches
	const onMove = (e: PointerEvent) => {
		if (isTouch(e)) return
		if (!e.isTrusted) hold = performance.now() + 1000
		lastX = e.clientX
		lastY = e.clientY
		if (!box) fit()
		toUnit(e.clientX, e.clientY)
		if (!act) enterAt(e.clientX, e.clientY)
		else go()
	}
	const onIn = (e: PointerEvent) => !isTouch(e) && enterAt(e.clientX, e.clientY)
	const onDown = (e: PointerEvent) => {
		if (e.pointerType !== "touch" || touchQ.matches) return
		enterAt(e.clientX, e.clientY)
		setTimeout(leave, 600)
	}
	const onFoc = () => {
		fit()
		if (!box) return
		px = 0.5
		py = o.aspect / 2
		t0 = performance.now()
		gone = 0
		act = 1
		go()
		setTimeout(leave, 900)
	}
	root.addEventListener("pointerenter", onIn, { passive: true })
	root.addEventListener("pointermove", onMove, { passive: true })
	root.addEventListener("pointerleave", leave)
	root.addEventListener("pointerdown", onDown)
	root.addEventListener("focusin", onFoc)
	root.addEventListener("focusout", leave)
	const ro =
		typeof ResizeObserver !== "undefined"
			? new ResizeObserver(() => {
					fit()
					if (amb) go()
				})
			: null
	let lastX = 0
	let lastY = 0
	const onScr = () => {
		if (!act || amb) return
		fit()
		if (box) toUnit(lastX, lastY)
		go()
	}
	window.addEventListener("scroll", onScr, { passive: true, capture: true })
	ro?.observe(svg)
	const io =
		typeof IntersectionObserver !== "undefined"
			? new IntersectionObserver(
					([e]) => {
						seen = !!e?.isIntersecting
						sync()
						if (!seen && raf && hold < performance.now()) {
							cancelAnimationFrame(raf)
							raf = 0
							last = 0
							rest()
						} else go()
					},
					{ threshold: 0.2 },
				)
			: null
	const sync = () => {
		const next = seen && !document.hidden && wantsAmb()
		if (next === amb) return
		amb = next
		if (amb) {
			fit()
			go()
		} else {
			if (act) gone = performance.now()
			act = 0
			go()
		}
	}
	const onVis = () => sync()
	const reduceQ = matchMedia("(prefers-reduced-motion: reduce)")
	const onReduce = () => go()
	document.addEventListener("visibilitychange", onVis)
	touchQ.addEventListener?.("change", sync)
	reduceQ.addEventListener?.("change", onReduce)
	io?.observe(svg)
	fit()
	if (!io) sync()
	return () => {
		root.removeEventListener("pointerenter", onIn)
		root.removeEventListener("pointermove", onMove)
		root.removeEventListener("pointerleave", leave)
		root.removeEventListener("pointerdown", onDown)
		root.removeEventListener("focusin", onFoc)
		root.removeEventListener("focusout", leave)
		ro?.disconnect()
		io?.disconnect()
		window.removeEventListener("scroll", onScr, { capture: true })
		document.removeEventListener("visibilitychange", onVis)
		touchQ.removeEventListener?.("change", sync)
		reduceQ.removeEventListener?.("change", onReduce)
		if (timer) clearTimeout(timer)
		if (raf) cancelAnimationFrame(raf)
		for (const t of o.targets) {
			t.el.style.transform = ""
		}
	}
}
const curves = {
	smoothstep: (t: number) => t * t * (3 - 2 * t),
} as const
type Curve = keyof typeof curves
function spring(value: number, vel0: number, goal: number, stiff: number, damp: number, dt: number): [number, number] {
	const steps = Math.max(1, Math.ceil(dt * 240))
	const h = dt / steps
	let x = value
	let v = vel0
	for (let n = 0; n < steps; n++) {
		v += (-stiff * (x - goal) - damp * v) * h
		x += v * h
	}
	return [x, v]
}
const MOTION: Spec = {
	ir: 1,
	behavior: "displace",
	pointer: {
		falloff: {
			shape: "radial",
			radius: 0.35,
			curve: "smoothstep",
		},
	},
	react: [
		{
			target: "motif",
			property: "scale",
			along: "x",
			max: 2.53,
			map: "falloff",
		},
		{
			target: "motif",
			property: "scale",
			along: "y",
			max: 2.37,
			map: "falloff",
		},
	],
	stagger: {
		by: "none",
		ms: 0,
	},
	leave: {
		settle: "spring",
		spring: {
			stiffness: 900,
			damping: 60,
		},
	},
	rest: "static",
	reducedMotion: "static",
	a11y: {
		keyboard: "center-pulse",
		touch: "ambient",
	},
}
export type WarpProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
}
export function Warp({ tokens, className = "", static: isStatic = false }: WarpProps) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => selfSize(ref.current), [])
	const geometry = useGeometry()
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic || !geometry) return
		const nodes = root.querySelectorAll<SVGGraphicsElement>("svg [data-role]")
		const targets: Target[] = geometry.elements.map((e, index) => ({
			el: nodes[index]!,
			role: e.role,
			index,
			cx: e.cx,
			cy: e.cy,
		}))
		return mount(root, { spec: MOTION, targets, aspect: ASPECT, min: MIN_BOX })
	}, [isStatic, geometry])
	return (
		<div
			ref={ref}
			aria-hidden="true"
			data-texture="warp"
			className={className}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "clip",
				isolation: "isolate",
				contain: "layout paint style",
				containerType: "size",
				backgroundColor: "var(--texture-field,var(--background))",
				color: "var(--texture-ink,var(--foreground))",
				...(tokens as CSSProperties),
			}}
		>
			<svg
				viewBox={`0 0 1 ${ASPECT}`}
				preserveAspectRatio="xMidYMid slice"
				style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}
				fill="currentColor"
				fillRule="nonzero"
				focusable="false"
			>
				{(geometry?.elements ?? []).map((e) => (
					<path key={e.id} data-role={e.role} d={e.d} />
				))}
			</svg>
		</div>
	)
}
