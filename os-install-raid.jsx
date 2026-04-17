import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// PHASES
// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 0 — PRE-INSTALL: hardware RAID già fatto, server in boot ISO
// PHASE 1 — ANACONDA: installer text mode
// PHASE 2 — FIRST BOOT: post-install config

const initState = () => ({
  phase: 0,   // 0=pre, 1=anaconda, 2=firstboot

  // RAID (già fatto nel scenario precedente)
  raidVD: { dev:"/dev/sda", size:"446GB", type:"RAID1", state:"Optl" },

  // Anaconda selections
  lang:         null,
  timezone:     null,
  keyboard:     null,
  rootPw:       null,
  partScheme:   null,   // "lvm" | "standard" | "custom"
  partDone:     false,
  softwareSet:  null,   // "minimal" | "server" | "workstation"
  networkSet:   false,
  hostnameSet:  null,
  installDone:  false,

  // Partitions created (custom/lvm)
  partitions: [],   // [{ dev, size, mount, fs, type }]
  vgs: {},
  lvs: {},

  // Anaconda menu items completed
  menu: {
    lang:       false,
    timezone:   false,
    keyboard:   false,
    partition:  false,
    software:   false,
    network:    false,
    rootpw:     false,
    user:       false,
  },

  // First boot
  bootOk:       false,
  networkUp:    false,
  selinuxMode:  "enforcing",
  firewallUp:   false,
  updated:      false,

  // Log
  log: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const o  = v => ({ t:"out",  v });
const e  = v => ({ t:"err",  v });
const ok = v => ({ t:"ok",   v });
const w  = v => ({ t:"warn", v });
const d  = v => ({ t:"dim",  v });
const h  = v => ({ t:"head", v });
const sep = () => d(`─────────────────────────────────────────────────────────`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 0 ENGINE — pre-install, server con ISO
// ═══════════════════════════════════════════════════════════════════════════════
function runPhase0(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");

  if (cmd === "lsblk") {
    return [
      ok(`NAME  MAJ:MIN RM  SIZE RO TYPE  MOUNTPOINT`),
      ok(`sda     8:0   0  446G  0 disk`),
      d(`# /dev/sda = VD RAID1 dell'LSI controller — 2x SSD 480GB`),
      d(`# Disco pronto per il partizionamento`),
    ];
  }

  if (cmd === "fdisk" && rest.includes("-l")) {
    return [
      ok(`Disk /dev/sda: 446 GiB`),
      ok(`Disk model: LSI MR9361-8i`),
      ok(`Disklabel type: unknown  ← ancora da partizionare`),
    ];
  }

  if (cmd === "cat" && rest.includes("cpuinfo")) {
    return [ok(`processor: 0..7  (8 vCPU)`), ok(`model name: Intel Xeon E5-2680 v4 @ 2.40GHz`)];
  }
  if (cmd === "free" || cmd === "cat" && rest.includes("meminfo")) {
    return [ok(`MemTotal: 32 GB`), ok(`SwapTotal: 0 kB  ← swap verrà creato durante install`)];
  }
  if (cmd === "ip" && (rest.includes("link") || rest.includes("a"))) {
    return [ok(`2: ens192: <BROADCAST,MULTICAST> mtu 1500`), d(`# NIC presente, non configurata — sarà settata in anaconda`)];
  }

  // launch installer
  if (cmd === "anaconda" || cmd === "startinstall" || (cmd === "boot" && rest.includes("install")) || cmd === "install") {
    set(s => ({ ...s, phase: 1 }));
    return [{ t:"__PHASE__", v:"1" }];
  }

  if (cmd === "hint") return [{ t:"warn", v:`💡 Digita 'anaconda' per avviare l'installer` }];
  if (cmd === "help") return [
    h(`━━ PRE-INSTALL ━━`),
    o(`  lsblk              — verifica che /dev/sda (VD RAID1) sia visibile`),
    o(`  fdisk -l           — info disco`),
    o(`  ip link show       — verifica NIC`),
    o(`  free -h            — RAM disponibile`),
    o(`  anaconda           — avvia installer Oracle Linux 8`),
  ];
  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "") return [];
  return [e(`-bash: ${cmd}: command not found`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 ENGINE — Anaconda text mode
// ═══════════════════════════════════════════════════════════════════════════════
function runPhase1(raw, st, set) {
  const p   = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");
  const arg1 = p[1] || "";
  const arg2 = p[2] || "";

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (cmd === "menu" || cmd === "m" || cmd === "") {
    const M = st.menu;
    const allRequired = M.lang && M.timezone && M.partition && M.software && M.rootpw;
    return [
      sep(),
      h(`  ORACLE LINUX 8 INSTALLER — Anaconda Text Mode`),
      sep(),
      o(``),
      h(`  LOCALIZZAZIONE`),
      o(`  1) ${M.lang     ? "✓" : "!"} Language          ${M.lang     ? st.lang : "→ da impostare"}`),
      o(`  2) ${M.keyboard ? "✓" : "!"} Keyboard          ${M.keyboard ? st.keyboard : "→ da impostare"}`),
      o(`  3) ${M.timezone ? "✓" : "!"} Timezone          ${M.timezone ? st.timezone : "→ da impostare"}`),
      o(``),
      h(`  SISTEMA`),
      o(`  4) ${M.partition? "✓" : "!"} Partitioning       ${M.partition ? st.partScheme?.toUpperCase() + " — ✓ configurato" : "→ DA CONFIGURARE"}`),
      o(`  5) ${M.network  ? "✓" : "!"} Network           ${M.network  ? `${st.hostnameSet} — configurato` : "→ da impostare"}`),
      o(``),
      h(`  SOFTWARE`),
      o(`  6) ${M.software ? "✓" : "!"} Software Selection ${M.software ? st.softwareSet : "→ da impostare"}`),
      o(``),
      h(`  UTENTI`),
      o(`  7) ${M.rootpw   ? "✓" : "!"} Root Password     ${M.rootpw   ? "• • • • • •" : "→ da impostare"}`),
      o(`  8) ${M.user     ? "✓" : "!"} User creation     ${M.user     ? "✓" : "(opzionale)"}`),
      o(``),
      allRequired
        ? ok(`  [b] Begin installation — PRONTO ✓`)
        : w(`  [b] Begin installation — completa i passaggi obbligatori (!) prima`),
      sep(),
      d(`  Digita il numero o il nome del comando (es: '1' o 'lang')`),
    ];
  }

  // ── LANGUAGE ──────────────────────────────────────────────────────────────
  if (cmd === "1" || cmd === "lang" || cmd === "language") {
    if (arg1) {
      const l = arg1 === "it" ? "Italian (Italy)" : arg1 === "en" ? "English (United States)" : arg1;
      set(s => ({ ...s, lang: l, menu: { ...s.menu, lang: true } }));
      return [ok(`Lingua impostata: ${l}`), d(`Digita 'menu' per tornare al menu`)];
    }
    return [
      h(`━━ LINGUA ━━`),
      o(`  1) English (United States)   [en]`),
      o(`  2) Italian (Italy)           [it]`),
      o(`  3) ...`),
      d(`Digita: lang en  oppure  lang it`),
    ];
  }

  // ── KEYBOARD ──────────────────────────────────────────────────────────────
  if (cmd === "2" || cmd === "keyboard" || cmd === "kbd") {
    if (arg1) {
      const k = arg1 === "it" ? "it (Italian)" : arg1 === "us" ? "us (US)" : arg1;
      set(s => ({ ...s, keyboard: k, menu: { ...s.menu, keyboard: true } }));
      return [ok(`Tastiera: ${k}`)];
    }
    return [d(`Digita: keyboard it  oppure  keyboard us`)];
  }

  // ── TIMEZONE ──────────────────────────────────────────────────────────────
  if (cmd === "3" || cmd === "timezone" || cmd === "tz") {
    if (arg1) {
      const tz = arg1.includes("/") ? arg1 : `Europe/${arg1.charAt(0).toUpperCase()+arg1.slice(1)}`;
      set(s => ({ ...s, timezone: tz, menu: { ...s.menu, timezone: true } }));
      return [ok(`Timezone: ${tz}`)];
    }
    return [d(`Digita: timezone Europe/Rome`)];
  }

  // ── PARTITIONING ──────────────────────────────────────────────────────────
  if (cmd === "4" || cmd === "partition" || cmd === "disk" || cmd === "storage") {
    return [
      h(`━━ PARTITIONING — /dev/sda (446 GB, LSI MR RAID1) ━━`),
      o(``),
      o(`  Schemi disponibili:`),
      ok(`  auto-lvm    — Partizionamento automatico con LVM (raccomandato)`),
      o(`  auto        — Partizionamento automatico standard`),
      o(`  custom      — Partizionamento manuale completo`),
      o(``),
      d(`  auto-lvm crea:  /boot (1GB) · / in LVM (restante) · swap (RAM*2)`),
      d(`  custom ti permette di definire ogni partizione a mano`),
      o(``),
      d(`Digita: part auto-lvm  oppure  part custom`),
    ];
  }

  if (cmd === "part" || cmd === "parted" || cmd === "partscheme") {
    const scheme = arg1.toLowerCase();

    if (scheme === "auto-lvm" || scheme === "auto_lvm" || scheme === "lvm") {
      set(s => ({
        ...s,
        partScheme: "lvm",
        partDone:   true,
        partitions: [
          { dev:"/dev/sda1", size:"1GB",   mount:"/boot",   fs:"xfs",  type:"standard" },
          { dev:"/dev/sda2", size:"445GB",  mount:"PV",      fs:"LVM",  type:"pv" },
        ],
        vgs: { ol: { size:"445GB", pvs:["/dev/sda2"] } },
        lvs: {
          root: { vg:"ol", size:"50GB",  mount:"/",     fs:"xfs"  },
          home: { vg:"ol", size:"100GB", mount:"/home", fs:"xfs"  },
          var:  { vg:"ol", size:"50GB",  mount:"/var",  fs:"xfs"  },
          swap: { vg:"ol", size:"8GB",   mount:"swap",  fs:"swap" },
        },
        menu: { ...s.menu, partition: true },
      }));
      return [
        ok(`Schema automatico LVM selezionato su /dev/sda`),
        o(``),
        ok(`  /dev/sda1     1 GB    /boot          xfs`),
        ok(`  /dev/sda2   445 GB    PV (LVM)       ---`),
        ok(`    └─ ol-root  50 GB   /              xfs`),
        ok(`    └─ ol-home 100 GB   /home          xfs`),
        ok(`    └─ ol-var   50 GB   /var           xfs`),
        ok(`    └─ ol-swap   8 GB   [SWAP]         swap`),
        ok(`       (libero 237GB — espandibile con lvcreate)`),
        o(``),
        d(`Digita 'menu' per tornare al menu principale`),
      ];
    }

    if (scheme === "custom") {
      set(s => ({ ...s, partScheme: "custom" }));
      return [
        h(`━━ PARTITIONING MANUALE ━━`),
        o(``),
        o(`  Disco: /dev/sda  446 GB`),
        o(`  Spazio libero: 446 GB`),
        o(``),
        d(`  Comandi:`),
        o(`  mkpart /boot  xfs   1GB   — partizione /boot`),
        o(`  mkpart swap   swap  8GB   — swap`),
        o(`  mkpart /      xfs   100GB — root`),
        o(`  mkpart /var   xfs   50GB  — /var separato (raccomandato)`),
        o(`  mkpart /home  xfs   100GB — /home`),
        o(`  mklvm ol /dev/sda2        — VG LVM sul resto`),
        o(`  partdone                  — conferma schema`),
      ];
    }

    if (scheme === "auto" || scheme === "standard") {
      set(s => ({
        ...s,
        partScheme: "standard",
        partDone:   true,
        partitions: [
          { dev:"/dev/sda1", size:"1GB",   mount:"/boot",  fs:"xfs",  type:"standard" },
          { dev:"/dev/sda2", size:"8GB",   mount:"swap",   fs:"swap", type:"standard" },
          { dev:"/dev/sda3", size:"437GB", mount:"/",      fs:"xfs",  type:"standard" },
        ],
        menu: { ...s.menu, partition: true },
      }));
      return [
        ok(`/dev/sda1   1 GB   /boot  xfs`),
        ok(`/dev/sda2   8 GB   swap   swap`),
        ok(`/dev/sda3 437 GB   /      xfs`),
        w(`# Senza LVM non puoi espandere le partizioni a caldo — considera auto-lvm`),
      ];
    }

    return [e(`Schema non riconosciuto. Usa: auto-lvm | auto | custom`)];
  }

  // Custom partitioning subcommands
  if (cmd === "mkpart") {
    const mp  = arg1;
    const fs  = arg2;
    const sz  = p[3];
    if (!mp || !fs || !sz) return [d(`uso: mkpart <mountpoint> <fs> <dimensione>`)];
    const idx = st.partitions.length + 1;
    set(s => ({
      ...s,
      partitions: [...s.partitions, { dev:`/dev/sda${idx}`, size:sz, mount:mp, fs, type:"standard" }],
    }));
    return [ok(`Partizione ${mp} (${sz}, ${fs}) aggiunta`)];
  }
  if (cmd === "partdone" || cmd === "accept") {
    if (!st.partitions.length) return [e(`Nessuna partizione definita`)];
    const hasRoot = st.partitions.some(p => p.mount === "/");
    const hasBoot = st.partitions.some(p => p.mount === "/boot");
    if (!hasRoot) return [e(`Manca la partizione root (/)`)];
    set(s => ({ ...s, partDone: true, menu: { ...s.menu, partition: true } }));
    return [
      ok(`Schema confermato:`),
      ...st.partitions.map(p => ok(`  ${p.dev.padEnd(12)} ${p.size.padEnd(7)} ${p.mount.padEnd(10)} ${p.fs}`)),
      hasBoot ? null : w(`⚠ Nessuna /boot separata — il bootloader andrà su /dev/sda`),
    ].filter(Boolean);
  }

  // ── NETWORK ───────────────────────────────────────────────────────────────
  if (cmd === "5" || cmd === "network" || cmd === "net") {
    if (arg1 === "dhcp" || arg1 === "auto") {
      set(s => ({ ...s, networkSet: true, hostnameSet: "auto (DHCP)", menu: { ...s.menu, network: true } }));
      return [ok(`Rete: DHCP su ens192`), d(`Hostname verrà assegnato dal DHCP`)];
    }
    if (arg1 === "static" || arg1.match(/^\d+\.\d+/)) {
      const ip = arg1.match(/^\d+\./) ? arg1 : arg2;
      const hn = p.find(x => x.includes(".") && !x.match(/^\d+\.\d+\.\d+\.\d+/)) || "server01.prod.local";
      set(s => ({ ...s, networkSet: true, hostnameSet: hn, menu: { ...s.menu, network: true } }));
      return [ok(`Rete: IP statico ${ip}`), ok(`Hostname: ${hn}`)];
    }
    return [
      h(`━━ RETE ━━`),
      o(`  net dhcp                             — DHCP automatico`),
      o(`  net static 10.0.1.100/24 10.0.1.1   — IP statico`),
      o(`  net static 10.0.1.100/24 10.0.1.1 server01.prod.local`),
    ];
  }
  if (cmd === "hostname") {
    const hn = arg1;
    if (!hn) return [d(`Digita: hostname <nome.dominio>`)];
    set(s => ({ ...s, hostnameSet: hn, networkSet: true, menu: { ...s.menu, network: true } }));
    return [ok(`Hostname: ${hn}`)];
  }

  // ── SOFTWARE ──────────────────────────────────────────────────────────────
  if (cmd === "6" || cmd === "software" || cmd === "sw") {
    if (arg1) {
      const sets = {
        "minimal":    "Minimal Install",
        "server":     "Server with GUI",
        "server-gui": "Server with GUI",
        "basic":      "Basic Web Server",
        "web":        "Basic Web Server",
        "infra":      "Infrastructure Server",
        "workstation":"Workstation",
      };
      const chosen = sets[arg1] || arg1;
      set(s => ({ ...s, softwareSet: chosen, menu: { ...s.menu, software: true } }));
      return [ok(`Software: ${chosen}`)];
    }
    return [
      h(`━━ SOFTWARE SELECTION ━━`),
      o(`  minimal     — Solo OS base (raccomandato per server)`),
      o(`  server      — Server con ambiente GUI`),
      o(`  web         — Web Server (Apache, PHP...)`),
      o(`  infra       — Infrastructure Server`),
      o(``),
      d(`Digita: software minimal`),
    ];
  }

  // ── ROOT PASSWORD ─────────────────────────────────────────────────────────
  if (cmd === "7" || cmd === "rootpw" || cmd === "rootpass" || cmd === "passwd") {
    if (arg1) {
      set(s => ({ ...s, rootPw: arg1, menu: { ...s.menu, rootpw: true } }));
      return [ok(`Password root impostata.`), d(`(Non viene mostrata in chiaro)`)];
    }
    return [d(`Digita: rootpw <password>  — es: rootpw Str0ng!Pass`)];
  }

  // ── USER ──────────────────────────────────────────────────────────────────
  if (cmd === "8" || cmd === "user" || cmd === "adduser") {
    if (arg1) {
      set(s => ({ ...s, menu: { ...s.menu, user: true } }));
      return [ok(`Utente '${arg1}' creato${rest.includes("sudo")||rest.includes("wheel") ? " (con sudo)" : ""}`)];
    }
    return [d(`Digita: user giovanni sudo  — crea utente con sudo`)];
  }

  // ── BEGIN INSTALL ─────────────────────────────────────────────────────────
  if (cmd === "b" || cmd === "begin" || cmd === "install" || cmd === "start") {
    const M = st.menu;
    const missing = [];
    if (!M.lang)      missing.push("Lingua (1)");
    if (!M.timezone)  missing.push("Timezone (3)");
    if (!M.partition) missing.push("Partitioning (4)");
    if (!M.software)  missing.push("Software (6)");
    if (!M.rootpw)    missing.push("Root password (7)");

    if (missing.length) {
      return [
        e(`Impossibile avviare — mancano:`),
        ...missing.map(m => e(`  ✗ ${m}`)),
        d(`Completa le voci obbligatorie poi digita 'b' di nuovo`),
      ];
    }

    // INSTALL SEQUENCE
    set(s => ({ ...s, installDone: true }));
    return [{ t:"__INSTALL__", v:"" }];
  }

  // ── SHOW ──────────────────────────────────────────────────────────────────
  if (cmd === "show" || cmd === "summary") {
    const pvs = st.partitions.filter(p => p.type !== "pv");
    return [
      h(`━━ CONFIGURAZIONE ATTUALE ━━`),
      o(`Disco:     /dev/sda (RAID1, 446GB)`),
      o(`Schema:    ${st.partScheme || "non definito"}`),
      o(`Lingua:    ${st.lang || "—"}`),
      o(`Timezone:  ${st.timezone || "—"}`),
      o(`Software:  ${st.softwareSet || "—"}`),
      o(`Hostname:  ${st.hostnameSet || "—"}`),
      o(`Root PW:   ${st.rootPw ? "impostata" : "—"}`),
      ...Object.entries(st.lvs||{}).map(([n,v]) => o(`  /dev/${v.vg}-${n}  ${v.size}  ${v.mount}  ${v.fs}`)),
      ...pvs.map(p => o(`  ${p.dev}  ${p.size}  ${p.mount}  ${p.fs}`)),
    ];
  }

  if (cmd === "hint") {
    const M = st.menu;
    const hints = [
      !M.lang && `lang en  — imposta lingua`,
      !M.keyboard && `keyboard us  — imposta tastiera`,
      !M.timezone && `timezone Europe/Rome`,
      !M.partition && `4  → poi:  part auto-lvm  (partizionamento automatico con LVM)`,
      !M.network && `net static 10.0.1.100/24 10.0.1.1 web01.prod.local`,
      !M.software && `software minimal  — minimal install per server`,
      !M.rootpw && `rootpw Str0ng!Pass`,
      !M.user && `user giovanni sudo  — (opzionale)`,
      M.lang&&M.timezone&&M.partition&&M.software&&M.rootpw && `b  — begin installation`,
    ].filter(Boolean);
    return hints.length ? [{ t:"warn", v:`💡 ${hints[0]}` }] : [ok(`💡 Tutto configurato — digita 'b' per installare`)];
  }

  if (cmd === "help") return [
    h(`━━ ANACONDA TEXT MODE ━━`),
    o(`  menu             — torna al menu principale`),
    o(`  1 / lang         — lingua`),
    o(`  2 / keyboard     — tastiera`),
    o(`  3 / timezone     — timezone`),
    o(`  4 / partition    — disco e partizioni`),
    o(`    part auto-lvm  — schema automatico LVM`),
    o(`    part custom    — manuale`),
    o(`  5 / net dhcp     — rete DHCP`),
    o(`    net static <IP> <GW> <hostname>`),
    o(`  6 / software minimal`),
    o(`  7 / rootpw <pass>`),
    o(`  8 / user <nome> sudo`),
    o(`  show             — riepilogo configurazione`),
    o(`  b                — avvia installazione`),
    o(`  hint             — prossimo passo`),
  ];

  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "" || cmd === "q") return [];
  return [w(`Comando non riconosciuto: '${cmd}'. Digita 'menu' o 'help'.`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 ENGINE — First boot post-install
// ═══════════════════════════════════════════════════════════════════════════════
function runPhase2(raw, st, set) {
  const p   = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");

  const hn = (st.hostnameSet || "server01").split(".")[0];

  if (cmd === "hostnamectl") {
    if (p[1] === "status" || !p[1]) return [
      ok(`   Static hostname: ${st.hostnameSet || hn}`),
      ok(`  Operating System: Oracle Linux 8.9`),
      ok(`           Kernel: Linux 5.15.0-206.153.7.el8uek.x86_64`),
    ];
  }

  if (cmd === "lsblk") {
    return [
      ok(`NAME              MAJ:MIN RM   SIZE RO TYPE  MOUNTPOINT`),
      ok(`sda                 8:0   0   446G  0 disk   ← RAID1 VD`),
      ok(`├─sda1              8:1   0     1G  0 part   /boot`),
      ok(`└─sda2              8:2   0   445G  0 part`),
      ...Object.entries(st.lvs||{}).map(([n,v]) => ok(`  └─ol-${n.padEnd(6)} 253:x  0  ${v.size.padEnd(5)} 0 lvm  ${v.mount}`)),
    ];
  }

  if (cmd === "df") {
    return [
      ok(`Filesystem           Size  Used Avail Use% Mounted on`),
      ok(`/dev/mapper/ol-root   50G  2.1G   48G   5% /`),
      ok(`/dev/sda1            976M  201M  775M  21% /boot`),
      ok(`/dev/mapper/ol-home  100G    0G  100G   0% /home`),
      ok(`/dev/mapper/ol-var    50G  400M   50G   1% /var`),
    ];
  }

  if (cmd === "ip") {
    if (rest.includes("addr") || rest.startsWith("a")) {
      if (!st.networkUp) return [e(`2: ens192: <BROADCAST,MULTICAST> mtu 1500  ← non configurata`)];
      return [
        ok(`2: ens192: <BROADCAST,MULTICAST,UP> mtu 1500`),
        ok(`   inet 10.0.1.100/24 brd 10.0.1.255 scope global ens192`),
      ];
    }
  }

  if (cmd === "nmcli") {
    if (rest.includes("con up") || rest.includes("up ens")) {
      set(s => ({ ...s, networkUp: true }));
      return [ok(`Connection 'ens192' activated.`)];
    }
    if (rest.includes("con show")) {
      return [
        ok(`NAME    UUID      TYPE      DEVICE`),
        st.networkUp ? ok(`ens192  aaa-001   ethernet  ens192`) : w(`ens192  aaa-001   ethernet  --`),
      ];
    }
    if (rest.includes("con mod")) {
      return [ok(`Connection modificata. Applica: nmcli con up ens192`)];
    }
  }

  if (cmd === "dnf" || cmd === "yum") {
    const sub = p[1];
    if (sub === "update" || sub === "upgrade") {
      set(s => ({ ...s, updated: true }));
      return [
        d(`Oracle Linux 8.9 BaseOS`),
        ok(`Aggiornati: 47 pacchetti`),
        ok(`Completato!`),
      ];
    }
    if (sub === "install") {
      return [ok(`Installato: ${p.slice(2).filter(x=>!x.startsWith("-")).join(", ")}`)];
    }
  }

  if (cmd === "systemctl") {
    const sub  = p[1];
    const unit = p.slice(2).find(x=>!x.startsWith("-")) || "";
    if (unit === "firewalld") {
      if (sub === "enable" || sub === "start") {
        set(s => ({ ...s, firewallUp: true }));
        return [ok(`firewalld avviato e abilitato.`)];
      }
      if (sub === "status") return st.firewallUp ?
        [ok(`● firewalld.service  Active: active (running)`)] :
        [e(`● firewalld.service  Active: inactive`)];
    }
    if (unit === "sshd") return [ok(`sshd.service: active (running)`)];
    return [ok(`${unit}: ok`)];
  }

  if (cmd === "firewall-cmd") {
    if (!st.firewallUp) return [e(`FirewallD is not running`)];
    if (raw.includes("--add-service")) {
      const svc = raw.match(/--add-service=(\S+)/)?.[1];
      return [ok(`success — ${svc} aggiunto`)];
    }
    if (raw.includes("--list-all")) return [
      ok(`public (active)`),
      ok(`  services: ssh dhcpv6-client`),
    ];
    return [ok(`success`)];
  }

  if (cmd === "getenforce") return [ok(st.selinuxMode.charAt(0).toUpperCase()+st.selinuxMode.slice(1))];
  if (cmd === "sestatus") return [ok(`SELinux status: enabled`), ok(`Current mode: ${st.selinuxMode}`)];

  if (cmd === "free") return [
    o(`               total    used    free`),
    ok(`Mem:           32Gi    1.2Gi   30.8Gi`),
    ok(`Swap:           8Gi      0B     8Gi`),
  ];

  if (cmd === "uname") return [ok(`Linux ${hn} 5.15.0-206.153.7.el8uek.x86_64 #1 Oracle Linux 8`)];
  if (cmd === "whoami") return [ok(`root`)];
  if (cmd === "hostname") return [ok(st.hostnameSet || hn)];
  if (cmd === "uptime") return [ok(` 00:04:12 up 4 min,  1 user,  load average: 0.05, 0.03, 0.00`)];

  if (cmd === "checklist" || cmd === "status") {
    return [
      h(`━━ STATO POST-INSTALL ━━`),
      o(``),
      ok(`✓ OS installato: Oracle Linux 8.9`),
      ok(`✓ RAID1 hardware: /dev/sda (LSI MR, Optl)`),
      ok(`✓ LVM: ol-root ol-home ol-var ol-swap`),
      st.hostnameSet ? ok(`✓ Hostname: ${st.hostnameSet}`) : w(`~ Hostname non configurato`),
      st.networkUp   ? ok(`✓ Rete: 10.0.1.100/24`) : w(`~ Rete non attivata  →  nmcli con up ens192`),
      st.updated     ? ok(`✓ Sistema aggiornato`) : w(`~ dnf update -y`),
      st.firewallUp  ? ok(`✓ Firewall: attivo`) : w(`~ systemctl enable --now firewalld`),
      ok(`✓ SELinux: ${st.selinuxMode}`),
      o(``),
      h(`Prossimi passi:`),
      !st.networkUp  ? w(`  nmcli con up ens192`) : null,
      !st.updated    ? w(`  dnf update -y`) : null,
      !st.firewallUp ? w(`  systemctl enable --now firewalld`) : null,
      ok(`  dnf install -y vim curl wget bash-completion`),
      ok(`  useradd -m -s /bin/bash -G wheel <utente>`),
      ok(`  vi /etc/ssh/sshd_config  → PermitRootLogin no`),
    ].filter(Boolean);
  }

  if (cmd === "hint") {
    const hints = [
      !st.networkUp  && `nmcli con up ens192  — attiva la rete`,
      !st.updated    && `dnf update -y  — aggiorna il sistema`,
      !st.firewallUp && `systemctl enable --now firewalld`,
      st.firewallUp  && `firewall-cmd --add-service=ssh --permanent && firewall-cmd --reload`,
      `vi /etc/ssh/sshd_config  — PermitRootLogin no`,
      `useradd -m -s /bin/bash -G wheel giovanni`,
      `checklist  — stato completo`,
    ].filter(Boolean);
    return [{ t:"warn", v:`💡 ${hints[0]}` }];
  }

  if (cmd === "help") return [
    h(`━━ FIRST BOOT ━━`),
    o(`  checklist          — stato configurazione`),
    o(`  lsblk | df -h      — verifica partizioni`),
    o(`  nmcli con up ens192`),
    o(`  dnf update -y`),
    o(`  systemctl enable --now firewalld`),
    o(`  firewall-cmd --add-service=ssh --permanent`),
    o(`  getenforce`),
    o(`  uname -r`),
    o(`  hint`),
  ];

  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "") return [];
  return [e(`-bash: ${cmd}: command not found`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEPS per fase
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS = [
  { label:"RAID VD visibile", phase:0, done: s => true },   // sempre true, viene dal prev scenario
  { label:"Installer avviato", phase:0, done: s => s.phase >= 1 },
  { label:"Partizionamento",  phase:1, done: s => s.menu?.partition },
  { label:"Lingua/TZ/KB",     phase:1, done: s => s.menu?.lang && s.menu?.timezone },
  { label:"Software set",     phase:1, done: s => s.menu?.software },
  { label:"Root PW",          phase:1, done: s => s.menu?.rootpw },
  { label:"Installazione",    phase:1, done: s => s.installDone },
  { label:"Rete attiva",      phase:2, done: s => s.networkUp },
  { label:"Aggiornato",       phase:2, done: s => s.updated },
  { label:"Firewall",         phase:2, done: s => s.firewallUp },
];

// ═══════════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [st, setSt]       = useState(null);
  const [hist, setHist]   = useState([]);
  const [input, setInput] = useState("");
  const [cmdH, setCmdH]   = useState([]);
  const [hidx, setHidx]   = useState(-1);
  const [installing, setInstalling] = useState(false);
  const bot = useRef(), inp = useRef();

  const col = { out:"#a0c8a8", err:"#e06060", ok:"#5ad890", warn:"#e8a020", prompt:"#5a9acf", dim:"#2a4a30", head:"#5ae890" };
  const phaseLabels = ["Pre-install", "Anaconda Installer", "First Boot"];
  const phaseColors = ["#1a3a4a","#1a4a30","#4a3a10"];

  useEffect(() => { bot.current?.scrollIntoView({ behavior:"smooth" }); }, [hist]);

  function start() {
    const s = initState();
    setSt(s);
    setTimeout(() => {
      setHist([
        { t:"head", v:`╔══════════════════════════════════════════════════════════════════╗` },
        { t:"head", v:`║  🖥  INSTALLAZIONE OS SU RAID HARDWARE                            ║` },
        { t:"head", v:`║  Oracle Linux 8.9 · LSI MegaRAID RAID1 · LVM                     ║` },
        { t:"head", v:`╚══════════════════════════════════════════════════════════════════╝` },
        { t:"out",  v:`` },
        { t:"ok",   v:`Il VD RAID1 è già configurato: /dev/sda (446GB, Optimal)` },
        { t:"out",  v:`` },
        { t:"dim",  v:`Server bootato da ISO Oracle Linux 8. Sei in una shell di rescue.` },
        { t:"dim",  v:`Verifica che il VD sia visibile all'OS, poi avvia l'installer.` },
        { t:"out",  v:`` },
        { t:"warn", v:`Digita 'anaconda' per avviare l'installer, o 'hint' per guidarti.` },
        { t:"out",  v:`` },
      ]);
      inp.current?.focus();
    }, 50);
  }

  // Install animation
  function doInstall(finalSt) {
    setInstalling(true);
    const steps = [
      [600,  `[  1/12] Partizionamento disco...`],
      [1200, `[  2/12] Creazione filesystem...`],
      [1800, `[  3/12] Configurazione LVM...`],
      [2400, `[  4/12] Installazione pacchetti base (${finalSt.softwareSet})...`],
      [3000, `[  5/12] Installazione kernel...`],
      [3600, `[  6/12] Configurazione bootloader (grub2)...`],
      [4000, `[  7/12] Configurazione rete...`],
      [4400, `[  8/12] Configurazione SELinux (enforcing)...`],
      [4800, `[  9/12] Configurazione firewalld...`],
      [5200, `[ 10/12] Applicazione impostazioni localizzazione...`],
      [5600, `[ 11/12] Installazione completata. Configurazione finale...`],
      [6400, `[ 12/12] Pronto al reboot.`],
    ];
    steps.forEach(([delay, msg]) => {
      setTimeout(() => {
        setHist(h => [...h, { t: delay < 6000 ? "dim" : "ok", v: msg }]);
      }, delay);
    });
    setTimeout(() => {
      setInstalling(false);
      setHist(h => [...h,
        { t:"out", v:"" },
        { t:"ok",  v:`╔══════════════════════════════════════════════════════════════════╗` },
        { t:"ok",  v:`║  ✅  INSTALLAZIONE COMPLETATA                                     ║` },
        { t:"ok",  v:`║  Oracle Linux 8.9 installato su /dev/sda (RAID1 LSI)             ║` },
        { t:"ok",  v:`╚══════════════════════════════════════════════════════════════════╝` },
        { t:"out", v:"" },
        { t:"warn", v:`Sistema in reboot...` },
        { t:"out", v:"" },
      ]);
      setTimeout(() => {
        setHist(h => [...h,
          { t:"head", v:`╔══════════════════════════════════════════════════════════════════╗` },
          { t:"head", v:`║  🚀  ORACLE LINUX 8.9 — FIRST BOOT                               ║` },
          { t:"head", v:`║  ${(finalSt.hostnameSet||"server01").padEnd(66)}║` },
          { t:"head", v:`╚══════════════════════════════════════════════════════════════════╝` },
          { t:"out",  v:"" },
          { t:"dim",  v:`Oracle Linux 8.9 (Red Hat Enterprise Linux) 5.15.0-206.153.7.el8uek.x86_64` },
          { t:"dim",  v:`Kernel 5.15.0-206.153.7.el8uek.x86_64 on an x86_64` },
          { t:"out",  v:"" },
          { t:"ok",   v:`${(finalSt.hostnameSet||"server01").split(".")[0]} login: root` },
          { t:"out",  v:"" },
          { t:"dim",  v:`'checklist' per lo stato · 'hint' per il prossimo passo` },
          { t:"out",  v:"" },
        ]);
        setSt(s => ({ ...s, phase: 2, installDone: true }));
      }, 1500);
    }, 6800);
  }

  function submit() {
    if (installing) return;
    const fullInput = input.trim(); if (!fullInput) return;
    setCmdH(h => [fullInput,...h].slice(0,100)); setHidx(-1);

    const cmds = fullInput.split(/\s*&&\s*/).map(s => s.trim()).filter(Boolean);
    const hn = (st?.hostnameSet || "server").split(".")[0];
    const prompt = st?.phase === 2
      ? `[root@${hn} ~]# `
      : st?.phase === 1
      ? `anaconda> `
      : `[rescue]# `;

    const allLines = [{ t:"prompt", v:`${prompt}${fullInput}` }];
    let currentSt = st;

    for (const c of cmds) {
      let pending = currentSt;
      const localSet = fn => { pending = typeof fn === "function" ? fn(pending) : fn; };
      const engine = currentSt.phase === 0 ? runPhase0
                   : currentSt.phase === 1 ? runPhase1
                   : runPhase2;
      const out = engine(c, currentSt, localSet);

      // phase change
      if (out.some(o => o.t === "__PHASE__")) {
        const newPhase = parseInt(out.find(o => o.t==="__PHASE__").v);
        pending = { ...pending, phase: newPhase };
        setHist(h => [...h, ...allLines,
          { t:"out", v:"" },
          { t:"head", v:`━━ AVVIO ANACONDA INSTALLER ━━` },
          { t:"dim",  v:`Oracle Linux 8.9 — Text Mode` },
          { t:"out",  v:"" },
        ]);
        setSt(pending);
        setInput("");
        // Show menu after brief delay
        setTimeout(() => {
          const menuOut = runPhase1("menu", pending, ()=>{});
          setHist(h => [...h, ...menuOut, { t:"out", v:"" }]);
        }, 300);
        return;
      }

      // install trigger
      if (out.some(o => o.t === "__INSTALL__")) {
        setHist(h => [...h, ...allLines,
          { t:"out", v:"" },
          { t:"warn", v:`Avvio installazione su /dev/sda...` },
          { t:"out", v:"" },
        ]);
        setSt(pending);
        setInput("");
        doInstall(pending);
        return;
      }

      if (out.some(o => o.t === "__CLEAR__")) { setHist([]); setInput(""); return; }
      allLines.push(...out);
      currentSt = pending;
    }

    allLines.push({ t:"out", v:"" });
    setHist(h => [...h, ...allLines]);
    setSt(currentSt);
    setInput("");
  }

  function onKey(e) {
    if (e.key==="Enter")     { submit(); return; }
    if (e.key==="ArrowUp")   { e.preventDefault(); const i=Math.min(hidx+1,cmdH.length-1); setHidx(i); setInput(cmdH[i]||""); }
    if (e.key==="ArrowDown") { e.preventDefault(); const i=Math.max(hidx-1,-1); setHidx(i); setInput(i===-1?"":cmdH[i]||""); }
  }

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (!st) return (
    <div style={{ minHeight:"100vh", background:"#050c08", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono','Fira Code',monospace", padding:24 }}>
      <div style={{ maxWidth:600, textAlign:"center" }}>
        <div style={{ fontSize:10, letterSpacing:6, color:"#1a3020", textTransform:"uppercase", marginBottom:16 }}>Linux SysAdmin · OS Install su RAID</div>
        <div style={{ fontSize:26, fontWeight:900, color:"#0a1810", marginBottom:10 }}>Installa Oracle Linux 8<br/>su RAID Hardware.</div>
        <div style={{ fontSize:12, color:"#2a4a30", marginBottom:28, lineHeight:1.9 }}>
          Il RAID1 è già configurato (VD <code style={{color:"#5ad890"}}>/dev/sda</code>, 446GB, LSI Optl).<br/>
          Devi: avviare l'installer Anaconda, partizionare con LVM,<br/>
          scegliere il software, installare, e configurare il first boot.
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:28 }}>
          {["Boot da ISO","Anaconda Text Mode","Partizionamento LVM","Installazione","First Boot"].map((s,i) => (
            <div key={i} style={{ background:"#080e0a", border:"1px solid #1a3020", borderRadius:6, padding:"8px 10px", fontSize:9, color:"#3a6a40", textAlign:"center", minWidth:70 }}>
              <div style={{ fontSize:16, marginBottom:4 }}>{"💿🔧📦⚙️🚀"[i]}</div>
              {s}
            </div>
          ))}
        </div>
        <button onClick={start}
          style={{ background:"#0a1e10", border:"1px solid #1a6030", borderRadius:6, padding:"12px 40px", color:"#5ad890", fontSize:13, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer", letterSpacing:2 }}
          onMouseOver={e=>e.currentTarget.style.background="#0e2418"}
          onMouseOut={e=>e.currentTarget.style.background="#0a1e10"}>
          Boot da ISO → inizia
        </button>
      </div>
    </div>
  );

  // ── TERMINAL ──────────────────────────────────────────────────────────────
  const phase = st.phase;
  const doneCnt = STEPS.filter(s => s.done(st)).length;
  const pct = Math.round(doneCnt / STEPS.length * 100);

  return (
    <div style={{ height:"100vh", background:"#050c08", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* titlebar */}
      <div style={{ background:"#080e0a", borderBottom:"1px solid #1a2a1a", padding:"7px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
        </div>
        {[0,1,2].map(i => (
          <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:3, background: phase===i ? "#1a3020":"#080e0a", border:`1px solid ${phase===i?"#2a5a30":"#1a2a1a"}`, color: phase===i?"#5ad890":"#1a3020" }}>
            {["💿 Pre-install","🔧 Anaconda","🚀 First Boot"][i]}
          </span>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ height:4, width:100, background:"#0a140a", borderRadius:2 }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"#2a7a30", borderRadius:2, transition:"width 0.5s" }}/>
          </div>
          <span style={{ fontSize:10, color:"#3a6a40" }}>{pct}%</span>
          <button onClick={()=>{setSt(null);setHist([]);setInput("");}}
            style={{ padding:"2px 10px", background:"#101a10", border:"1px solid #1a2a1a", borderRadius:4, color:"#2a4a2a", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
            ← Reset
          </button>
        </div>
      </div>

      {/* progress steps */}
      <div style={{ padding:"5px 14px", borderBottom:"1px solid #1a2a1a", background:"#060c06", display:"flex", gap:3, flexWrap:"wrap", flexShrink:0 }}>
        {STEPS.map((s,i) => {
          const done = s.done(st);
          const active = s.phase === phase;
          return (
            <span key={i} style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:done?"#0a1e0a":"#060c06", border:`1px solid ${done?"#2a5a30":active?"#1a3a1a":"#1a2a1a"}`, color:done?"#5ad890":active?"#2a4a2a":"#1a2a1a", transition:"all 0.3s" }}>
              {done?"✓":"○"} {s.label}
            </span>
          );
        })}
      </div>

      {/* output */}
      <div onClick={()=>{ if(!installing) inp.current?.focus(); }} style={{ flex:1, overflowY:"auto", padding:"12px 16px", cursor:"text" }}>
        {hist.map((l,i) => (
          <div key={i} style={{ color:col[l.t]||"#a0c8a8", fontSize:12, lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-all", fontWeight:l.t==="head"?"700":"normal" }}>
            {l.v}
          </div>
        ))}
        {installing && (
          <div style={{ color:"#e8a020", fontSize:12, animation:"none" }}>▋ installazione in corso...</div>
        )}
        <div ref={bot}/>
      </div>

      {/* input */}
      <div style={{ borderTop:"1px solid #1a2a1a", padding:"9px 16px", display:"flex", alignItems:"center", gap:8, background:"#040a04", flexShrink:0, opacity: installing ? 0.4 : 1 }}>
        <span style={{ color:"#2a6a30", fontSize:12, whiteSpace:"nowrap" }}>
          {phase === 1 ? "anaconda>" : phase === 2 ? `[root@${(st.hostnameSet||"server").split(".")[0]} ~]#` : "[rescue]#"}
        </span>
        <input ref={inp} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
          disabled={installing}
          autoFocus spellCheck={false} autoComplete="off"
          style={{ flex:1, background:"none", border:"none", outline:"none", color:"#a0c8a8", fontFamily:"inherit", fontSize:12.5, caretColor:"#5ad890" }}/>
      </div>
    </div>
  );
}
