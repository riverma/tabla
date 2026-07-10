/* ============================================================================
   Virtual Tabla — HTML5 port of the original 2007 Flash application.
   © Rishi Verma. All rights reserved.

   A self-contained, offline-first, mobile-first virtual tabla. All sounds and
   song sequences were recovered from the original tabla.swf; the audio engine,
   visuals and sequencer are a modern Web-Audio reimplementation.
   ============================================================================ */
"use strict";

/* ---------------------------------------------------------------------------
   Bols — the spoken syllables of the tabla. Each maps to one recovered sample
   and to one of the two drums (for the lighting effect).
   bayan  = larger bass drum (left in the photo)
   dayan  = smaller treble drum (right in the photo)
--------------------------------------------------------------------------- */
const BOLS = {
	ge:  { file: "ghe.mp3", label: "Ge",  drum: "bayan", key: "s", desc: "open bass" },
	ke:  { file: "ke.mp3",  label: "Ke",  drum: "bayan", key: "e", desc: "closed bass" },
	ta:  { file: "ta.mp3",  label: "Na",  drum: "dayan", key: "j", desc: "rim" },
	tin: { file: "tin.mp3", label: "Tin", drum: "dayan", key: "k", desc: "open ring" },
	too: { file: "too.mp3", label: "Tun", drum: "dayan", key: "l", desc: "resonant" },
	te:  { file: "te.mp3",  label: "Te",  drum: "dayan", key: "o", desc: "damped" }
};

// Pre-mixed phrase samples used only by the recovered "Tabla Solo" composition.
const NOTES = {};
for (let i = 1; i <= 14; i++) NOTES["note" + i] = { file: i + ".mp3", drum: "both" };

const KEYMAP = {};
for (const id in BOLS) KEYMAP[BOLS[id].key] = id;

/* ---------------------------------------------------------------------------
   Highlight zones — geometry recovered from the original SWF's *_mv movieclips,
   in the background photo's 614×461 coordinate space. Each bol lights its own
   region, so you can see exactly which part of which drum makes which sound.
   The treble bols nest from the rim (Na) inward to the syahi (Tun); the bass
   bols cover the bāyāñ. Order here = paint order (inner zones drawn last/on top
   so a centre tap hits the innermost bol).
--------------------------------------------------------------------------- */
const ZONES = {
	ke:  { cx: 190, cy: 199, rx: 146, ry: 120,  label: [80, 358, "middle"], leader: [108, 300] },
	ge:  { cx: 190, cy: 194, rx: 108, ry: 92,   label: [190, 170, "middle"], leader: null },
	ta:  { cx: 477, cy: 180, rx: 76.5, ry: 53.8, label: [600, 250, "end"], leader: [550, 181] },
	tin: { cx: 475, cy: 177, rx: 55.5, ry: 39.9, label: [600, 288, "end"], leader: [528, 178] },
	te:  { cx: 476, cy: 177, rx: 42.2, ry: 29.8, label: [600, 326, "end"], leader: [516, 178] },
	too: { cx: 492, cy: 194, rx: 19.0, ry: 13.8, label: [600, 364, "end"], leader: [509, 194] }
};

/* ---------------------------------------------------------------------------
   Songs — recovered note-for-note from the SWF timeline (10 frames / step at
   the original 30 fps, so 180 bpm reproduces the original speed). Each entry
   lists the tokens (bols or "noteN" samples) struck on each step.
--------------------------------------------------------------------------- */
const SONGS = {
	dadra: {
		name: "Dādrā", taal: "6 beats", steps: 6,
		events: { 0: ["ge", "ta"], 1: ["ge", "tin"], 2: ["ta"], 3: ["ge", "ta"], 4: ["tin"], 5: ["ta"] }
	},
	tintal: {
		name: "Tīntāl", taal: "16 beats", steps: 16,
		events: {
			0: ["ge", "ta"], 1: ["ge", "tin"], 2: ["ge", "tin"], 3: ["ge", "ta"],
			4: ["ge", "ta"], 5: ["ge", "tin"], 6: ["ge", "tin"], 7: ["ge", "ta"],
			8: ["ge", "ta"], 9: ["tin"], 10: ["tin"], 11: ["ta"],
			12: ["ta"], 13: ["ge", "tin"], 14: ["ge", "tin"], 15: ["ge", "ta"]
		}
	},
	jhaptal: {
		name: "Jhaptāl", taal: "10 beats", steps: 10,
		events: {
			0: ["ge", "tin"], 1: ["ta"], 2: ["ge", "tin"], 3: ["ge", "tin"], 4: ["ta"],
			5: ["tin"], 6: ["ta"], 7: ["ge", "tin"], 8: ["ge", "tin"], 9: ["ta"]
		}
	},
	keherwa: {
		name: "Keherwā", taal: "8 beats", steps: 8,
		events: {
			0: ["ge", "ta"], 1: ["ge"], 2: ["ta"], 3: ["te"],
			4: ["ta"], 5: ["ke"], 6: ["ge", "tin"], 7: ["ta"]
		}
	},
	// The background song (a lehra-style melodic accompaniment) — recovered from
	// the original's `backgroundMusic` clip. Not a taal; it loops underneath the
	// theka as a toggleable layer.
	// steps = 32 (not 34): the last note (note14) is at step 30, so a 32-step loop
	// brings note1 back 2 beats later — the same cadence as the rest of the phrase —
	// instead of leaving ~3 empty beats of dead air before it repeats.
	bg: {
		name: "Background song", background: true, steps: 32,
		events: {
			0: ["note1"], 2: ["note1"], 4: ["note1"], 6: ["note2"], 7: ["note3"],
			8: ["note4"], 10: ["note4"], 12: ["note4"], 14: ["note5"], 15: ["note6"],
			16: ["note7"], 18: ["note8"], 20: ["note1"], 22: ["note9"], 23: ["note10"],
			24: ["note8"], 26: ["note11"], 27: ["note12"], 28: ["note13"], 30: ["note14"]
		}
	}
};

/* ---------------------------------------------------------------------------
   Audio engine — Web Audio for low-latency, polyphonic playback.
--------------------------------------------------------------------------- */
const Audio = (() => {
	let ctx = null;
	const buffers = {};        // id -> AudioBuffer
	let gain = null;
	let ready = false;

	function ensure() {
		if (ctx) return;
		ctx = new (window.AudioContext || window.webkitAudioContext)();
		gain = ctx.createGain();
		gain.gain.value = 0.9;
		gain.connect(ctx.destination);
	}

	async function loadOne(id, file) {
		const res = await fetch("app/sounds/" + file);
		const arr = await res.arrayBuffer();
		buffers[id] = await ctx.decodeAudioData(arr);
	}

	async function init(onProgress) {
		ensure();
		const jobs = [];
		const all = [];
		for (const id in BOLS) all.push([id, BOLS[id].file]);
		for (const id in NOTES) all.push([id, NOTES[id].file]);
		let done = 0;
		for (const [id, file] of all) {
			jobs.push(loadOne(id, file).then(() => { done++; onProgress && onProgress(done, all.length); }));
		}
		await Promise.all(jobs);
		ready = true;
	}

	// Play a buffer at an absolute AudioContext time (or now if omitted).
	function playAt(id, when, vol) {
		if (!buffers[id]) return;
		const src = ctx.createBufferSource();
		src.buffer = buffers[id];
		if (vol != null) {
			const g = ctx.createGain();
			g.gain.value = vol;
			src.connect(g); g.connect(gain);
		} else {
			src.connect(gain);
		}
		src.start(when || ctx.currentTime);
	}

	return {
		init,
		resume: () => { ensure(); if (ctx.state === "suspended") ctx.resume(); },
		now: () => (ctx ? ctx.currentTime : 0),
		play: (id, vol) => playAt(id, 0, vol),
		playAt,
		setVolume: (v) => { if (gain) gain.gain.value = v; },
		get ready() { return ready; }
	};
})();

/* ---------------------------------------------------------------------------
   Visuals — build the SVG zone overlay and flash the exact zone for each bol.
--------------------------------------------------------------------------- */
const Visual = (() => {
	const SVGNS = "http://www.w3.org/2000/svg";
	const groups = {};      // bol id -> <g>
	let svg, stage;

	function el(name, attrs) {
		const n = document.createElementNS(SVGNS, name);
		for (const k in attrs) n.setAttribute(k, attrs[k]);
		return n;
	}

	function init(onZoneStrike) {
		svg = document.getElementById("zones");
		stage = document.getElementById("stage");
		// Zones first (so labels paint above them).
		for (const id in ZONES) {
			const z = ZONES[id], b = BOLS[id];
			const g = el("g", { class: "zone zone-" + b.drum, "data-bol": id,
				role: "button", tabindex: "0",
				"aria-label": b.label + " — " + b.desc + ", key " + b.key.toUpperCase() });
			g.appendChild(el("ellipse", { class: "z-area", cx: z.cx, cy: z.cy, rx: z.rx, ry: z.ry }));
			g.appendChild(el("ellipse", { class: "z-glow", cx: z.cx, cy: z.cy, rx: z.rx, ry: z.ry }));
			if (onZoneStrike) {
				g.addEventListener("pointerdown", (e) => { e.preventDefault(); onZoneStrike(id); });
				g.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " " || e.code === "Space") { e.preventDefault(); onZoneStrike(id); }
				});
			}
			svg.appendChild(g);
			groups[id] = g;
		}
		// Labels layer (leader lines + text), toggleable.
		const labels = el("g", { class: "labels" });
		for (const id in ZONES) {
			const z = ZONES[id], b = BOLS[id];
			const [lx, ly, anchor] = z.label;
			if (z.leader) labels.appendChild(el("line", { class: "lead",
				x1: z.leader[0], y1: z.leader[1], x2: lx, y2: ly - 5 }));
			const t = el("text", { class: "lbl", x: lx, y: ly, "text-anchor": anchor });
			t.textContent = b.label + " · " + b.key.toUpperCase();
			labels.appendChild(t);
		}
		svg.appendChild(labels);
	}

	function flash(g) {
		if (!g) return;
		g.classList.remove("lit");
		void g.getBoundingClientRect();   // restart animation on rapid repeats
		g.classList.add("lit");
	}
	function strike(bol) { flash(groups[bol]); }
	function pulseAll() {                  // for the composed-solo samples
		if (stage) { stage.classList.remove("pulse"); void stage.offsetWidth; stage.classList.add("pulse"); }
	}
	return { init, strike, pulseAll };
})();

/* ---------------------------------------------------------------------------
   Play a single token (bol id or "noteN") — sound + light + pad pulse.
--------------------------------------------------------------------------- */
function strikeToken(token, when, vol) {
	Audio.playAt(token, when || 0, vol);
	// Schedule the visual to line up with the (possibly future) audio time.
	// Only the playable bols light a drum zone; background-song notes are audio only.
	if (!BOLS[token]) return;
	const delay = when ? Math.max(0, (when - Audio.now()) * 1000) : 0;
	setTimeout(() => {
		Visual.strike(token);
		const pad = document.querySelector('.pad[data-bol="' + token + '"]');
		if (pad) { pad.classList.remove("struck"); void pad.offsetWidth; pad.classList.add("struck"); }
	}, delay);
}

/* ---------------------------------------------------------------------------
   Sequencer — Web-Audio lookahead scheduler for the auto-play songs.
--------------------------------------------------------------------------- */
const Sequencer = (() => {
	let taal = null, taalOn = false;      // the theka layer
	const bg = SONGS.bg;
	let bgOn = false;                     // the background-song layer
	let bpm = 150;
	let step = 0, nextTime = 0, timer = null;
	const LOOKAHEAD = 0.1;     // seconds scheduled ahead
	const TICK = 25;           // ms between scheduler runs
	const BG_VOL = 0.7;        // background song sits under the bols
	let onStep = null;

	function stepDur() { return 60 / bpm; }
	function running() { return taalOn || bgOn; }

	function schedule() {
		while (nextTime < Audio.now() + LOOKAHEAD) {
			if (taalOn && taal) {
				const tk = taal.events[step % taal.steps];
				if (tk) for (const t of tk) strikeToken(t, nextTime);
			}
			if (bgOn) {
				const bk = bg.events[step % bg.steps];
				if (bk) for (const t of bk) strikeToken(t, nextTime, BG_VOL);
			}
			const cur = (taalOn && taal) ? step % taal.steps : -1;
			const at = nextTime;
			if (onStep) {
				const delay = Math.max(0, (at - Audio.now()) * 1000);
				setTimeout(() => onStep(cur), delay);
			}
			nextTime += stepDur();
			step++;
		}
	}

	// Start the clock when either layer turns on; stop it when both are off.
	function sync(resetGrid) {
		if (running()) {
			Audio.resume();
			if (resetGrid || !timer) { step = 0; nextTime = Audio.now() + 0.05; }
			if (!timer) { schedule(); timer = setInterval(schedule, TICK); }
		} else if (timer) {
			clearInterval(timer); timer = null;
			if (onStep) onStep(-1);
		}
	}

	return {
		setTaalKey: (key) => { taal = SONGS[key]; if (taalOn) sync(true); },
		playTaal: (on) => { taalOn = on; sync(on); },        // starting a taal resets to a downbeat
		setBg: (on) => { bgOn = on; sync(false); },           // background joins/leaves on the grid
		setBpm: (v) => { bpm = v; },
		setOnStep: (fn) => { onStep = fn; },
		get taalPlaying() { return taalOn; },
		get bgOn() { return bgOn; },
		get running() { return running(); },
		get bpm() { return bpm; }
	};
})();

/* ---------------------------------------------------------------------------
   UI wiring
--------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
	const stage = document.getElementById("stage");
	const loadingEl = document.getElementById("loading");
	const padRow = document.getElementById("pads");
	const songSel = document.getElementById("song");
	const playBtn = document.getElementById("playBtn");
	const tempo = document.getElementById("tempo");
	const tempoVal = document.getElementById("tempoVal");
	const beatDots = document.getElementById("beatdots");

	// Strike helper that also unlocks audio on the first user gesture.
	function hit(bol) { Audio.resume(); strikeToken(bol); }
	// Activate a control by keyboard (Enter / Space) without double-firing on tap.
	function keyActivate(el, bol) {
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " " || e.code === "Space") {
				e.preventDefault(); hit(bol);
			}
		});
	}

	// --- build bol pads ---
	for (const id in BOLS) {
		const b = BOLS[id];
		const pad = document.createElement("button");
		pad.className = "pad pad-" + b.drum;
		pad.dataset.bol = id;
		pad.type = "button";
		pad.setAttribute("aria-label", b.label + " (" + b.desc + "), key " + b.key.toUpperCase());
		pad.innerHTML =
			'<span class="pad-label">' + b.label + "</span>" +
			'<span class="pad-key">' + b.key.toUpperCase() + "</span>";
		pad.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(id); });
		keyActivate(pad, id);
		padRow.appendChild(pad);
	}

	// --- build the drum zones (tappable; each lights its own region) ---
	Visual.init(hit);

	// --- labels toggle (show/hide the bol legend on the drums) ---
	const labelToggle = document.getElementById("labelToggle");
	labelToggle.addEventListener("click", () => {
		const on = stage.classList.toggle("labels-off");
		labelToggle.setAttribute("aria-pressed", String(!on));
	});

	// --- keyboard (global bol keys + Space transport) ---
	const FORM = "input, select, textarea";
	window.addEventListener("keydown", (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
		const id = KEYMAP[e.key.toLowerCase()];
		if (id) { hit(id); e.preventDefault(); return; }
		// Space toggles play — but never when a form control or button has focus.
		if (e.code === "Space" && !(e.target.matches && e.target.matches(FORM + ", button, a, [tabindex]"))) {
			togglePlay(); e.preventDefault();
		}
	});

	// --- pause auto-play when the tab is hidden (prevents a burst of stacked
	//     notes when setInterval is throttled while the AudioContext clock runs) ---
	document.addEventListener("visibilitychange", () => {
		if (document.hidden && Sequencer.running) {
			Sequencer.playTaal(false);
			Sequencer.setBg(false);
			playBtn.classList.remove("playing");
			playBtn.setAttribute("aria-label", "Play");
			const bg = document.getElementById("bgToggle");
			if (bg) { bg.classList.remove("on"); bg.setAttribute("aria-pressed", "false"); }
		}
	});

	// --- taal selector (background song is a separate layer, not listed here) ---
	for (const key in SONGS) {
		if (SONGS[key].background) continue;
		const o = document.createElement("option");
		o.value = key;
		o.textContent = SONGS[key].name + " · " + SONGS[key].taal;
		songSel.appendChild(o);
	}
	Sequencer.setTaalKey(songSel.value);

	function rebuildBeatDots() {
		const s = SONGS[songSel.value];
		beatDots.innerHTML = "";
		for (let i = 0; i < s.steps; i++) {
			const d = document.createElement("span");
			d.className = "dot";
			beatDots.appendChild(d);
		}
	}
	Sequencer.setOnStep((i) => {
		const dots = beatDots.querySelectorAll(".dot");
		dots.forEach((d, n) => d.classList.toggle("on", n === i));
	});

	const bgToggle = document.getElementById("bgToggle");

	function togglePlay() {
		const on = !Sequencer.taalPlaying;
		Sequencer.setBpm(parseInt(tempo.value, 10));
		Sequencer.playTaal(on);
		playBtn.classList.toggle("playing", on);
		playBtn.setAttribute("aria-label", on ? "Stop" : "Play");
	}
	playBtn.addEventListener("click", togglePlay);
	songSel.addEventListener("change", () => {
		rebuildBeatDots();
		Sequencer.setTaalKey(songSel.value);   // re-syncs on a downbeat if playing
	});

	// --- background-song toggle (loops a melodic accompaniment under the taal) ---
	bgToggle.addEventListener("click", () => {
		const on = !Sequencer.bgOn;
		Sequencer.setBpm(parseInt(tempo.value, 10));
		Sequencer.setBg(on);
		bgToggle.classList.toggle("on", on);
		bgToggle.setAttribute("aria-pressed", String(on));
	});
	tempo.addEventListener("input", () => {
		tempoVal.textContent = tempo.value;
		Sequencer.setBpm(parseInt(tempo.value, 10));
	});
	tempoVal.textContent = tempo.value;
	rebuildBeatDots();

	// --- load audio (kick off on first interaction to satisfy autoplay policy,
	//     but also try immediately; decodeAudioData works pre-gesture) ---
	loadingEl.hidden = false;
	Audio.init((done, total) => {
		loadingEl.textContent = "Loading sounds… " + done + "/" + total;
	}).then(() => {
		loadingEl.hidden = true;
		stage.classList.add("ready");
	}).catch((err) => {
		loadingEl.hidden = false;
		loadingEl.textContent = (location.protocol === "file:")
			? "Sounds can’t load from a file:// path — open this page over http (a local server or the live site)."
			: "Could not load sounds. Check your connection and reload.";
		console.error(err);
	});
});
