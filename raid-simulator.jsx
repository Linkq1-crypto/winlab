import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
const SCENARIOS = [
  {
    id: "hw-raid1",
    icon: "🔲",
    title: "RAID 1 Hardware — Server nuovo",
    subtitle: "LSI MegaRAID 9361 · 2x SSD 480GB · storcli64",
    difficulty: "BASE",
    diffColor: "#2a8a40",
    desc: "Nuovo server rack. Il controller LSI è presente ma i dischi sono Unconfigured Good. Devi creare un Virtual Drive RAID 1 per l'OS, inizializzarlo e prepararlo per l'installazione.",
    bios_note: "Oggi: storcli64 — prima: Ctrl+H → WebBIOS al POST, oppure Ctrl+R su Dell PERC",
    init: () => ({
      controller: { model:"LSI MegaRAID SAS 9361-8i", firmware:"24.21.0-0014", cache:"1GB" },
      enclosure: 252,
      drives: [
        { slot:0, model:"Samsung PM883 480GB", size:"480GB", state:"UG", type:"SSD", group:null },
        { slot:1, model:"Samsung PM883 480GB", size:"480GB", state:"UG", type:"SSD", group:null },
        { slot:2, model:"", size:"", state:"Empty", type:"-", group:null },
        { slot:3, model:"", size:"", state:"Empty", type:"-", group:null },
      ],
      vds: [],
      // init track
      checkedCtrl:    false,
      checkedPDs:     false,
      createdVD:      false,
      initializedVD:  false,
      checkedVDOk:    false,
      solved:         false,
    }),
    steps: [
      { label:"Controller rilevato",   done: s => s.checkedCtrl },
      { label:"Dischi UG trovati",     done: s => s.checkedPDs },
      { label:"VD RAID 1 creato",      done: s => s.createdVD },
      { label:"Init / Fast Init",      done: s => s.initializedVD },
      { label:"VD Optimal",            done: s => s.checkedVDOk },
      { label:"✅ Pronto per OS",      done: s => s.solved },
    ],
    run: hwRaid1,
  },
  {
    id: "sw-raid5",
    icon: "🔵",
    title: "RAID 5 Software — mdadm",
    subtitle: "3x HDD 2TB · /dev/md0 · xfs",
    difficulty: "INTERMEDIO",
    diffColor: "#1a6a9a",
    desc: "Server di archiviazione. Tre dischi da 2TB non configurati. Devi creare un array RAID 5 software con mdadm, formattarlo xfs, montarlo e renderlo persistente al boot.",
    bios_note: "mdadm è il tool standard Linux per il RAID software. Nessun controller hardware necessario.",
    init: () => ({
      disks: [
        { dev:"/dev/sdb", size:"2TB", state:"raw", part:false },
        { dev:"/dev/sdc", size:"2TB", state:"raw", part:false },
        { dev:"/dev/sdd", size:"2TB", state:"raw", part:false },
      ],
      arrays: {},    // { "/dev/md0": { level, devs, state, size } }
      mounts: {},
      mdadmConf: false,
      fstabOk:   false,
      // track
      checkedDisks:   false,
      wipedDisks:     false,
      createdArray:   false,
      formatted:      false,
      mounted:        false,
      persistent:     false,
      solved:         false,
    }),
    steps: [
      { label:"Dischi rilevati",       done: s => s.checkedDisks },
      { label:"Dischi puliti",         done: s => s.wipedDisks },
      { label:"Array md0 creato",      done: s => s.createdArray },
      { label:"Formattato xfs",        done: s => s.formatted },
      { label:"Montato /data",         done: s => s.mounted },
      { label:"Persistente al boot",   done: s => s.persistent },
      { label:"✅ Array operativo",    done: s => s.solved },
    ],
    run: swRaid5,
  },
  {
    id: "raid-rebuild",
    icon: "🔴",
    title: "Sostituzione disco guasto — RAID rebuild",
    subtitle: "mdadm RAID 1 degraded · /dev/sdb failed · sostituzione",
    difficulty: "AVANZATO",
    diffColor: "#8a2a20",
    desc: "Array RAID 1 in stato degraded. /dev/sdb è guasto (Faulty). Il disco fisico è stato sostituito con uno nuovo. Devi rimuovere il disco guasto, aggiungere il nuovo e attendere il rebuild.",
    bios_note: "Scenario frequente in produzione. Su RAID hardware useresti storcli64 /cx/eX/sX replace.",
    init: () => ({
      arrays: {
        "/dev/md0": {
          level: "raid1", state:"degraded", size:"500GB",
          devs: [
            { dev:"/dev/sda1", state:"active" },
            { dev:"/dev/sdb1", state:"faulty" },
          ],
          rebuild: 0,   // rebuild percent
          rebuilding: false,
        }
      },
      newDisk: { dev:"/dev/sdc", size:"500GB", state:"raw" },
      // track
      checkedArray:   false,
      identifiedFault: false,
      removedFaulty:  false,
      wipedNew:       false,
      addedNew:       false,
      rebuildDone:    false,
      verified:       false,
      solved:         false,
    }),
    steps: [
      { label:"Array degraded",        done: s => s.checkedArray },
      { label:"Disco faulty",          done: s => s.identifiedFault },
      { label:"Rimosso guasto",        done: s => s.removedFaulty },
      { label:"Nuovo disco pulito",    done: s => s.wipedNew },
      { label:"Aggiunto al RAID",      done: s => s.addedNew },
      { label:"Rebuild completato",    done: s => s.rebuildDone },
      { label:"✅ Array healthy",      done: s => s.solved },
    ],
    run: raidRebuild,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Hardware RAID, storcli64
// ═══════════════════════════════════════════════════════════════════════════════
function hwRaid1(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");
  const o  = v => ({ t:"out",  v });
  const e  = v => ({ t:"err",  v });
  const ok = v => ({ t:"ok",   v });
  const w  = v => ({ t:"warn", v });
  const d  = v => ({ t:"dim",  v });

  // ── lspci / dmesg ─────────────────────────────────────────────────────────
  if (cmd === "lspci" || (cmd === "dmesg" && rest.includes("megaraid"))) {
    set(s => ({ ...s, checkedCtrl: true }));
    return [
      ok(`03:00.0 RAID bus controller: Broadcom / LSI MegaRAID SAS-3 9361-8i (rev 02)`),
      ok(`        Subsystem: Broadcom / LSI MegaRAID 9361-8i 1GB`),
      d(`# Controller presente. Firmware: 24.21.0-0014`),
      d(`# Usa storcli64 per gestirlo`),
    ];
  }

  // ── storcli64 ─────────────────────────────────────────────────────────────
  if (cmd === "storcli64" || cmd === "./storcli64" || cmd === "/opt/MegaRAID/storcli/storcli64") {
    const args = rest;

    // show all controllers
    if (args === "show" || args === "/call show") {
      set(s => ({ ...s, checkedCtrl: true }));
      return [
        ok(`CLI Version = 007.1703.0000.0000`),
        ok(`Operating system = Linux 5.15.0-206.153.7.el8uek.x86_64`),
        o(`-------------------------------------------------------------------`),
        ok(`Controller = 0`),
        ok(`Model = LSI MegaRAID SAS 9361-8i`),
        ok(`Serial Number = SVxxxxx`),
        ok(`FW Package Build = 24.21.0-0014`),
        ok(`Current Controller Date/Time = Mon 03/04/2026 11:08:00`),
        ok(`Cache Size = 1.0 GB`),
        ok(`BBU = Present`),
        ok(`Current Cache Policy = WriteBack, ReadAdaptive, Cached, No Write Cache if Bad BBU`),
      ];
    }

    // show all physical drives
    if (args.includes("/c0/eall/sall show") || args.includes("/c0 /eall /sall show") || args === "/c0 show all") {
      set(s => ({ ...s, checkedPDs: true }));
      return [
        ok(`Controller = 0`),
        o(`-------------------------------------------------------------------`),
        ok(`EID:Slt PID State DG       Size Intf Med SED PI SeSz Model              Sp`),
        ok(`-------------------------------------------------------------------`),
        ok(`252:0    0  UG    -   446.102 GB SATA SSD N   N  512B Samsung PM883 480G U`),
        ok(`252:1    1  UG    -   446.102 GB SATA SSD N   N  512B Samsung PM883 480G U`),
        w(`252:2    -  Empty -        -    -   -   -   -    -  -                    U`),
        w(`252:3    -  Empty -        -    -   -   -   -    -  -                    U`),
        o(`-------------------------------------------------------------------`),
        d(`# UG = Unconfigured Good — pronti per essere usati in un VD`),
        d(`# Crea RAID 1: storcli64 /c0 add vd type=raid1 drives=252:0,252:1`),
      ];
    }

    // create VD RAID 1
    if (args.includes("add vd") && args.includes("raid1") && args.includes("252:0,252:1")) {
      set(s => ({
        ...s,
        createdVD: true,
        drives: s.drives.map((d,i) => i < 2 ? { ...d, state:"Onln", group:0 } : d),
        vds: [{ id:0, name:"VD0", type:"RAID1", size:"446GB", state:"Optl", drives:"252:0,252:1", cache:"WB", init:"NotStarted" }],
      }));
      return [
        ok(`Virtual Drive Information:`),
        ok(`VD ID - 0`),
        ok(`VD Name: VD0`),
        ok(`RAID Level: Primary-1, Secondary-0, RAID Level Qualifier-0`),
        ok(`Size: 446.102 GB`),
        ok(`State: Optl`),
        ok(`Strip Size: 256 KB`),
        ok(`Number of Drives: 2`),
        ok(`Span Depth: 1`),
        ok(`Default Cache Policy: WriteBack, ReadAdaptive, Cached, No Write Cache if Bad BBU`),
        ok(`Drives: 252:0, 252:1`),
        ok(`VD0 add success`),
        o(``),
        w(`# VD creato ma Init non ancora eseguito`),
        d(`# Fast init: storcli64 /c0/v0 start init full=false`),
        d(`# Full init: storcli64 /c0/v0 start init full=true  (sovrascrive tutto — più lento)`),
      ];
    }

    // start init
    if (args.includes("/c0/v0 start init")) {
      if (!st.createdVD) return [e(`No VD found at /c0/v0`)];
      const full = args.includes("full=true");
      set(s => ({
        ...s,
        initializedVD: true,
        vds: s.vds.map(v => v.id===0 ? { ...v, init: full?"Full":"Fast", state:"Optl" } : v),
      }));
      return full
        ? [ok(`VD0 - Start Init Success`), d(`Init full in corso (~${Math.ceil(446/50)} min). Monitora: storcli64 /c0/v0 show init`)]
        : [ok(`VD0 - Start Fast Init Success`), ok(`Fast Init completato — VD pronto`), d(`Verifica: storcli64 /c0/v0 show`)];
    }

    // show init progress
    if (args.includes("show init")) {
      if (!st.initializedVD) return [w(`No initialization in progress`)];
      return [ok(`VD0 - Init Progress = 100%`), ok(`VD0 - Init Status = Completed`)];
    }

    // show VD
    if (args.includes("/c0/v0 show") || args.includes("/c0/vall show")) {
      if (!st.createdVD) return [w(`# Nessun Virtual Drive configurato`)];
      set(s => ({ ...s, checkedVDOk: true }));
      const vd = st.vds[0];
      return [
        ok(`Controller = 0`),
        ok(`VD LIST`),
        ok(`----------------------------------------------------------------------`),
        ok(`DG/VD TYPE  State Access Consist Cache Cac  sCC     Size Name`),
        ok(`----------------------------------------------------------------------`),
        ok(`0/0  RAID1  Optl  RW     Yes     RWTD  -   OFF  446.102 GB VD0`),
        ok(`----------------------------------------------------------------------`),
        ok(`Optl = Optimal`),
        d(`# VD in stato Optimal — pronto per l'installazione OS`),
        d(`# Il kernel lo vederà come /dev/sda  (o /dev/sdb se sda è già usato)`),
      ];
    }

    // show PD status
    if (args.includes("/c0/e252/s0 show") || args.includes("/c0/e252/s1 show")) {
      const slot = args.includes("s0") ? 0 : 1;
      const drv = st.drives[slot];
      return [
        ok(`Controller = 0`),
        ok(`Drive Information:`),
        ok(`EID:Slt State DG    Size    Intf Med Model`),
        ok(`252:${slot}   ${drv.state==="Onln"?"Onln":"UG  "}  ${drv.group!==null?"0 ":"-"} 446.102 GB SATA SSD Samsung PM883`),
        ok(`Shield Counter = 0`),
        ok(`Media Error Count = 0`),
        ok(`Other Error Count = 0`),
        ok(`BBM Error Count = 0`),
        drv.state === "Onln" ? ok(`Predictive Failure Count = 0`) : d(`Drive not in VD`),
      ];
    }

    // show BBU
    if (args.includes("bbu show")) {
      return [
        ok(`BBU Information:`),
        ok(`Type: BBU`),
        ok(`Voltage: 3987 mV`),
        ok(`Current: 0 mA`),
        ok(`Temperature: 24 C`),
        ok(`Battery State: Optimal`),
        ok(`Charger Status: Complete`),
        ok(`Learn Cycle Active: No`),
      ];
    }

    if (args === "" || args === "help" || args.includes("-h")) {
      return [
        d(`# Comandi principali storcli64:`),
        o(`  storcli64 show                          — lista controller`),
        o(`  storcli64 /c0/eall/sall show            — tutti i dischi fisici`),
        o(`  storcli64 /c0 add vd type=raid1 drives=252:0,252:1`),
        o(`  storcli64 /c0/v0 start init full=false  — fast init`),
        o(`  storcli64 /c0/v0 start init full=true   — full init`),
        o(`  storcli64 /c0/v0 show                   — stato VD`),
        o(`  storcli64 /c0/v0 show init              — progresso init`),
        o(`  storcli64 /c0 bbu show                  — stato batteria cache`),
      ];
    }

    return [e(`storcli64: command not recognized: ${args}`)];
  }

  // ── megacli (legacy) ──────────────────────────────────────────────────────
  if (cmd === "MegaCli" || cmd === "megacli" || cmd === "MegaCli64") {
    return [
      w(`# MegaCli è obsoleto. Usa storcli64 (Broadcom/LSI tool moderno)`),
      d(`# Download: https://docs.broadcom.com/`),
      d(`# storcli64 /c0/eall/sall show  ≡  MegaCli -PDList -aALL`),
    ];
  }

  // ── lsblk / fdisk ─────────────────────────────────────────────────────────
  if (cmd === "lsblk") {
    if (!st.createdVD) return [
      w(`NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT`),
      w(`# Nessun VD configurato — i dischi fisici sono gestiti dal controller`),
      w(`# Il controller LSI espone solo i Virtual Drive all'OS, non i dischi raw`),
    ];
    set(s => ({ ...s, checkedVDOk: true }));
    return [
      ok(`NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT`),
      ok(`sda      8:0    0  446G  0 disk`),
      d(`# sda = VD0 (RAID1 dei due SSD 480GB) esposto dall'LSI controller`),
      d(`# Pronto per partizionare e installare l'OS`),
    ];
  }

  if (cmd === "fdisk" && rest.includes("-l")) {
    if (!st.createdVD) return [w(`# Nessun disco esposto — VD non ancora creato`)];
    return [
      ok(`Disk /dev/sda: 446 GiB, 479069593600 bytes, 935682800 sectors`),
      ok(`Disk model: LSI MR9361-8i`),
      ok(`# Questo è il VD RAID1 esposto dal controller LSI`),
    ];
  }

  // ── universal ─────────────────────────────────────────────────────────────
  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "")      return [];

  if (cmd === "hint") {
    const hints = [
      !st.checkedCtrl && `lspci | grep -i raid  — c'è un controller?`,
      !st.checkedPDs  && `storcli64 /c0/eall/sall show  — vedi i dischi fisici`,
      !st.createdVD   && `storcli64 /c0 add vd type=raid1 drives=252:0,252:1`,
      !st.initializedVD && `storcli64 /c0/v0 start init full=false  — fast init`,
      !st.checkedVDOk && `storcli64 /c0/v0 show  — controlla stato Optl`,
      st.checkedVDOk  && `lsblk  — il VD è visibile all'OS come /dev/sda`,
    ].filter(Boolean);
    return hints.length ? [{ t:"warn", v:`💡 ${hints[0]}` }] : [ok(`💡 RAID 1 configurato e pronto!`)];
  }

  if (cmd === "help") return [
    { t:"head", v:`━━ COMANDI SCENARIO ━━` },
    o(`  lspci | grep -i raid`),
    o(`  storcli64 show`),
    o(`  storcli64 /c0/eall/sall show      — dischi fisici`),
    o(`  storcli64 /c0 add vd type=raid1 drives=252:0,252:1`),
    o(`  storcli64 /c0/v0 start init full=false`),
    o(`  storcli64 /c0/v0 show`),
    o(`  storcli64 /c0 bbu show            — stato batteria`),
    o(`  lsblk`),
    o(`  hint — prossimo passo`),
  ];

  return [e(`-bash: ${cmd}: command not found`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — Software RAID 5, mdadm
// ═══════════════════════════════════════════════════════════════════════════════
function swRaid5(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");
  const o  = v => ({ t:"out",  v });
  const e  = v => ({ t:"err",  v });
  const ok = v => ({ t:"ok",   v });
  const w  = v => ({ t:"warn", v });
  const d  = v => ({ t:"dim",  v });

  // ── lsblk / fdisk ─────────────────────────────────────────────────────────
  if (cmd === "lsblk") {
    set(s => ({ ...s, checkedDisks: true }));
    const md = st.arrays["/dev/md0"];
    return [
      o(`NAME   MAJ:MIN RM  SIZE RO TYPE  MOUNTPOINT`),
      o(`sda      8:0    0   50G  0 disk`),
      o(`├─sda1   8:1    0    1G  0 part  /boot`),
      o(`└─sda2   8:2    0   49G  0 part  /`),
      st.disks[0].part ? ok(`sdb      8:16   0    2T  0 disk`) : ok(`sdb      8:16   0    2T  0 disk  ← raw`),
      st.disks[0].part ? ok(`└─sdb1   8:17   0    2T  0 part`) : null,
      st.disks[1].part ? ok(`sdc      8:32   0    2T  0 disk`) : ok(`sdc      8:32   0    2T  0 disk  ← raw`),
      st.disks[1].part ? ok(`└─sdc1   8:33   0    2T  0 part`) : null,
      st.disks[2].part ? ok(`sdd      8:48   0    2T  0 disk`) : ok(`sdd      8:48   0    2T  0 disk  ← raw`),
      st.disks[2].part ? ok(`└─sdd1   8:49   0    2T  0 part`) : null,
      md ? ok(`md0      9:0    0    4T  0 raid5 ${md.mount||""}`) : null,
    ].filter(Boolean);
  }

  if (cmd === "fdisk" && rest.includes("-l")) {
    set(s => ({ ...s, checkedDisks: true }));
    return [
      ok(`Disk /dev/sda: 50 GiB`),
      ok(`Disk /dev/sdb: 2 TiB`),
      ok(`Disk /dev/sdc: 2 TiB`),
      ok(`Disk /dev/sdd: 2 TiB`),
      d(`# sdb/sdc/sdd sono raw — nessuna tabella delle partizioni`),
    ];
  }

  // ── wipefs / sgdisk / fdisk ───────────────────────────────────────────────
  if (cmd === "wipefs") {
    const devs = p.slice(1).filter(x => !x.startsWith("-") && x.startsWith("/dev/"));
    if (!devs.length) return [e(`wipefs: no device specified`)];
    set(s => ({
      ...s,
      wipedDisks: true,
      disks: s.disks.map(d => devs.includes(d.dev) ? { ...d, state:"wiped" } : d),
    }));
    return devs.map(d => ok(`${d}: 2 bytes were erased at offset 0x00000200 (gpt)`));
  }

  if (cmd === "sgdisk" || (cmd === "fdisk" && !rest.includes("-l"))) {
    const dev = p.find(x => x.startsWith("/dev/s") && x !== "/dev/sda") || "";
    if (!dev) return [o(`${cmd}: specificare un device`)];
    set(s => ({
      ...s,
      wipedDisks: true,
      disks: s.disks.map(d => d.dev === dev ? { ...d, part: true } : d),
    }));
    if (cmd === "sgdisk") {
      return [
        ok(`Creating new GPT entries in memory.`),
        ok(`The operation has completed successfully.`),
        d(`Tipo fd00 = Linux RAID`),
      ];
    }
    return [ok(`${dev}: partizionato — sdb1 tipo fd (Linux RAID)`)];
  }

  // ── parted ────────────────────────────────────────────────────────────────
  if (cmd === "parted") {
    const dev = p.find(x => x.startsWith("/dev/s") && x !== "/dev/sda") || "";
    set(s => ({
      ...s,
      wipedDisks: true,
      disks: s.disks.map(d => d.dev === dev ? { ...d, part: true } : d),
    }));
    return [
      ok(`GNU Parted 3.4`),
      ok(`(parted) mklabel gpt`),
      ok(`(parted) mkpart primary 0% 100%`),
      ok(`(parted) set 1 raid on`),
      ok(`(parted) quit`),
    ];
  }

  // ── mdadm --create ────────────────────────────────────────────────────────
  if (cmd === "mdadm") {
    const args = rest;

    if (args.includes("--create") && args.includes("--level=5") || args.includes("--level 5")) {
      const devMatch = args.match(/(\/dev\/s[bcd]\d?)/g) || [];
      if (devMatch.length < 3) return [e(`mdadm: need at least 3 devices for RAID 5`)];
      set(s => ({
        ...s,
        createdArray: true,
        arrays: {
          "/dev/md0": {
            level:"raid5", state:"active, resyncing", size:"3.99TB",
            devs: devMatch.map(d => ({ dev:d, state:"active" })),
            syncPct: 0, mount: null,
          }
        },
        disks: s.disks.map(d => ({ ...d, state:"in-array", part:true })),
      }));
      return [
        ok(`mdadm: layout defaults to left-symmetric`),
        ok(`mdadm: layout defaults to left-symmetric`),
        ok(`mdadm: chunk size defaults to 512K`),
        ok(`mdadm: Defaulting to version 1.2 metadata`),
        ok(`mdadm: array /dev/md0 started.`),
        o(``),
        w(`# Resync in corso — RAID 5 funziona subito ma la sincronizzazione prosegue in background`),
        d(`# Monitora: watch cat /proc/mdstat`),
        d(`# Salva config: mdadm --detail --scan >> /etc/mdadm/mdadm.conf`),
      ];
    }

    if (args.includes("--detail") && args.includes("/dev/md0")) {
      const arr = st.arrays["/dev/md0"];
      if (!arr) return [e(`mdadm: cannot open /dev/md0: No such file or directory`)];
      set(s => ({
        ...s,
        arrays: { ...s.arrays, "/dev/md0": { ...arr, syncPct: 100, state:"active" } }
      }));
      return [
        ok(`/dev/md0:`),
        ok(`           Version : 1.2`),
        ok(`     Creation Time : Mon Mar  4 11:08:00 2026`),
        ok(`        Raid Level : raid5`),
        ok(`        Array Size : 3.99 TB (3958.5 GiB)`),
        ok(`     Used Dev Size : 1.99 TB (1979.2 GiB)`),
        ok(`      Raid Devices : 3`),
        ok(`     Total Devices : 3`),
        arr.syncPct < 100 ? w(`            State : active, resyncing`) : ok(`            State : clean`),
        ok(`   Active Devices : 3`),
        ok(`  Working Devices : 3`),
        ok(`   Failed Devices : 0`),
        ok(`    Spare Devices : 0`),
        ok(`            Layout : left-symmetric`),
        ok(`        Chunk Size : 512K`),
        o(``),
        ok(`    Number   Major   Minor   RaidDevice State`),
        ok(`       0       8       17        0      active sync   /dev/sdb1`),
        ok(`       1       8       33        1      active sync   /dev/sdc1`),
        ok(`       3       8       49        2      active sync   /dev/sdd1`),
      ];
    }

    if (args.includes("--detail --scan") || args.includes("--examine --scan")) {
      if (!st.arrays["/dev/md0"]) return [d(`# Nessun array trovato`)];
      set(s => ({ ...s, mdadmConf: true, persistent: s.fstabOk }));
      return [
        ok(`ARRAY /dev/md0 metadata=1.2 name=server01:0 UUID=a1b2c3d4:e5f6a7b8:c9d0e1f2:a3b4c5d6`),
        d(`Salva in conf: mdadm --detail --scan >> /etc/mdadm/mdadm.conf`),
      ];
    }

    if (args.includes(">> /etc/mdadm") || args.includes("-s >>") || (args.includes("--scan") && raw.includes(">>"))) {
      set(s => ({ ...s, mdadmConf: true, persistent: s.fstabOk }));
      return [ok(`/etc/mdadm/mdadm.conf aggiornato — array persistente al boot`)];
    }

    if (args.includes("--stop")) return [ok(`mdadm: stopped /dev/md0`)];
    if (args.includes("--zero-superblock")) return [ok(`mdadm: zeroed superblock on ${p[p.length-1]}`)];

    return [e(`mdadm: argomenti non riconosciuti: ${args}`)];
  }

  // ── cat /proc/mdstat ──────────────────────────────────────────────────────
  if (cmd === "cat" && rest.includes("mdstat")) {
    const arr = st.arrays["/dev/md0"];
    if (!arr) return [o(`Personalities : [raid5]`), o(`unused devices: <none>`)];
    const synced = arr.syncPct >= 100;
    return [
      ok(`Personalities : [raid5] [raid6] [raid0] [raid1]`),
      ok(`md0 : ${synced ? "active" : "active, resyncing"} raid5 sdd1[3] sdc1[1] sdb1[0]`),
      ok(`      4183048192 blocks super 1.2 level 5, 512k chunk, algorithm 2 [3/3] [UUU]`),
      synced
        ? ok(`      bitmap: 0/16 pages [0KB], 65536KB chunk`)
        : w(`      [==========>..........]  resync = 52.3% (218GB/4000GB) finish=42.3min speed=150000K/sec`),
      o(``),
      o(`unused devices: <none>`),
    ];
  }

  // ── mkfs.xfs / mkfs.ext4 ─────────────────────────────────────────────────
  if (cmd === "mkfs.xfs" || cmd === "mkfs.ext4") {
    const dev = p[p.length-1];
    if (!dev.includes("md0") && !dev.includes("md")) return [e(`${cmd}: ${dev}: nessun array RAID attivo su questo device`)];
    if (!st.arrays["/dev/md0"]) return [e(`${cmd}: /dev/md0: No such file or directory`)];
    set(s => ({ ...s, formatted: true }));
    const fs = cmd.includes("xfs") ? "xfs" : "ext4";
    return [
      ok(`meta-data=/dev/md0  isize=512  agcount=32, agsize=32635008 blks`),
      ok(`data     =          bsize=4096  blocks=1044320256, imaxpct=25`),
      ok(`naming   =version 2 bsize=4096  ascii-ci=0, ftype=1`),
      ok(`log      =internal log bsize=4096 blocks=510312, version=2`),
      ok(`realtime =none    extsz=4096   blocks=0, rtextents=0`),
      ok(`/dev/md0 formattato come ${fs} — 3.99 TB`),
    ];
  }

  // ── mkdir / mount ─────────────────────────────────────────────────────────
  if (cmd === "mkdir") return [ok(`directory creata: ${p[p.length-1]}`)];

  if (cmd === "mount") {
    if (!rest) return [
      o(`sysfs on /sys`),
      o(`/dev/sda2 on / type xfs`),
      st.mounted ? ok(`/dev/md0 on /data type xfs (rw,relatime)`) : null,
    ].filter(Boolean);
    const dev = p.find(x => x.startsWith("/dev/")) || "";
    const mp  = p.find(x => x.startsWith("/") && !x.startsWith("/dev/")) || "";
    if (!st.formatted) return [e(`mount: /dev/md0: can't read superblock — formatta prima con mkfs.xfs`)];
    if (!mp) return [e(`mount: missing mount point`)];
    set(s => ({
      ...s,
      mounted: true,
      arrays: { ...s.arrays, "/dev/md0": { ...s.arrays["/dev/md0"], mount: mp } },
    }));
    return [ok(`/dev/md0 montato su ${mp} (xfs)`)];
  }

  if (cmd === "df") {
    if (!st.mounted) return [ok(`/dev/sda2   50G  5G  45G  10% /`)];
    return [
      ok(`/dev/sda2      50G    5G   45G  10% /`),
      ok(`/dev/md0     3.99T    0G  3.99T   0% /data`),
    ];
  }

  // ── fstab ─────────────────────────────────────────────────────────────────
  if ((cmd === "vi" || cmd === "nano" || cmd === "echo" || cmd === "tee") && rest.includes("fstab")) {
    set(s => ({ ...s, fstabOk: true, persistent: s.mdadmConf }));
    return [ok(`/etc/fstab aggiornato: /dev/md0 /data xfs defaults,nofail 0 0`)];
  }

  if (cmd === "cat" && rest.includes("fstab")) {
    return [
      o(`UUID=... / xfs defaults 0 0`),
      o(`UUID=... /boot xfs defaults 0 0`),
      st.fstabOk ? ok(`/dev/md0 /data xfs defaults,nofail 0 0`) : w(`# /dev/md0 non ancora in fstab`),
    ];
  }

  // ── dracut (rebuild initramfs with mdadm) ─────────────────────────────────
  if (cmd === "dracut" || (cmd === "update-initramfs")) {
    return [ok(`initramfs rigenerato con supporto mdadm/raid5`)];
  }

  // ── universal ─────────────────────────────────────────────────────────────
  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "")      return [];

  if (cmd === "hint") {
    const hints = [
      !st.checkedDisks  && `lsblk  — vedi i tre dischi da 2TB`,
      !st.wipedDisks    && `wipefs -a /dev/sdb /dev/sdc /dev/sdd  — cancella metadati precedenti`,
      !st.createdArray  && `mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sdb /dev/sdc /dev/sdd`,
      !st.formatted     && `mkfs.xfs /dev/md0`,
      !st.mounted       && `mkdir -p /data && mount /dev/md0 /data`,
      !st.mdadmConf     && `mdadm --detail --scan >> /etc/mdadm/mdadm.conf`,
      !st.fstabOk       && `echo '/dev/md0 /data xfs defaults,nofail 0 0' >> /etc/fstab`,
      st.fstabOk        && `cat /proc/mdstat  — verifica resync completato`,
    ].filter(Boolean);
    return hints.length ? [{ t:"warn", v:`💡 ${hints[0]}` }] : [ok(`💡 RAID 5 completamente configurato!`)];
  }

  if (cmd === "help") return [
    { t:"head", v:`━━ COMANDI SCENARIO ━━` },
    o(`  lsblk | fdisk -l`),
    o(`  wipefs -a /dev/sdb /dev/sdc /dev/sdd`),
    o(`  mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sdb /dev/sdc /dev/sdd`),
    o(`  cat /proc/mdstat`),
    o(`  mdadm --detail /dev/md0`),
    o(`  mkfs.xfs /dev/md0`),
    o(`  mkdir -p /data && mount /dev/md0 /data`),
    o(`  df -h`),
    o(`  mdadm --detail --scan >> /etc/mdadm/mdadm.conf`),
    o(`  echo '/dev/md0 /data xfs defaults,nofail 0 0' >> /etc/fstab`),
    o(`  hint — prossimo passo`),
  ];

  return [e(`-bash: ${cmd}: command not found`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — RAID rebuild, disco guasto
// ═══════════════════════════════════════════════════════════════════════════════
function raidRebuild(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");
  const o  = v => ({ t:"out",  v });
  const e  = v => ({ t:"err",  v });
  const ok = v => ({ t:"ok",   v });
  const w  = v => ({ t:"warn", v });
  const d  = v => ({ t:"dim",  v });

  const arr = st.arrays["/dev/md0"];

  // ── cat /proc/mdstat ──────────────────────────────────────────────────────
  if (cmd === "cat" && rest.includes("mdstat")) {
    set(s => ({ ...s, checkedArray: true }));
    if (arr.state === "clean") return [
      ok(`Personalities : [raid1]`),
      ok(`md0 : active raid1 sda1[0] sdc1[1]`),
      ok(`      524224448 blocks super 1.2 [2/2] [UU]`),
      ok(`      bitmap: 0/4 pages [0KB], 65536KB chunk`),
      o(`unused devices: <none>`),
    ];
    return [
      w(`Personalities : [raid1]`),
      e(`md0 : active raid1 sda1[0] sdb1[1](F)`),
      e(`      524224448 blocks super 1.2 [2/1] [U_]`),
      o(``),
      e(`# [U_] = un disco attivo, uno GUASTO (F = Faulty)`),
      e(`# Array degraded — rischio di perdita dati se sda1 si guasta`),
      w(`# Agisci subito: sostituire sdb fisicamente e ricostruire`),
    ];
  }

  // ── mdadm --detail ────────────────────────────────────────────────────────
  if (cmd === "mdadm" && rest.includes("--detail") && rest.includes("md0")) {
    set(s => ({ ...s, checkedArray: true, identifiedFault: true }));
    if (arr.state === "clean") return [
      ok(`/dev/md0: active clean raid1`),
      ok(`Active Devices : 2`),
      ok(`Working Devices : 2`),
      ok(`Failed Devices : 0`),
      ok(`    Number   Major   Minor   RaidDevice State`),
      ok(`       0       8       1        0      active sync   /dev/sda1`),
      ok(`       1       8       33       1      active sync   /dev/sdc1`),
    ];
    return [
      w(`/dev/md0:`),
      w(`        Raid Level : raid1`),
      w(`        Array Size : 500 GB`),
      e(`            State : clean, degraded`),
      e(`   Active Devices : 1`),
      e(`  Working Devices : 1`),
      e(`   Failed Devices : 1`),
      w(`    Spare Devices : 0`),
      o(``),
      w(`    Number   Major   Minor   RaidDevice State`),
      ok(`       0       8       1        0      active sync   /dev/sda1`),
      e(`       1       8       17       1      faulty         /dev/sdb1   ← GUASTO`),
      o(``),
      w(`# Operazione richiesta: rimuovere sdb1, inserire nuovo disco, aggiungere`),
    ];
  }

  // ── dmesg ─────────────────────────────────────────────────────────────────
  if (cmd === "dmesg") {
    set(s => ({ ...s, identifiedFault: true }));
    return [
      e(`[12345.678901] blk_update_request: I/O error, dev sdb, sector 1048576`),
      e(`[12346.012345] blk_update_request: I/O error, dev sdb, sector 2097152`),
      e(`[12347.234567] md/raid1:md0: Disk failure on sdb1, disabling device.`),
      e(`[12347.235000] md/raid1:md0: Operation continuing on 1 devices.`),
      w(`# sdb ha iniziato a dare errori I/O → mdadm lo ha rimosso automaticamente dall'array`),
    ];
  }

  // ── mdadm --remove ────────────────────────────────────────────────────────
  if (cmd === "mdadm" && rest.includes("--remove") && rest.includes("sdb1")) {
    if (!st.identifiedFault) return [e(`mdadm: identificare prima il disco guasto`)];
    set(s => ({
      ...s,
      removedFaulty: true,
      arrays: {
        ...s.arrays,
        "/dev/md0": {
          ...arr,
          devs: arr.devs.filter(d => !d.dev.includes("sdb")),
        }
      }
    }));
    return [
      ok(`mdadm: hot removed /dev/sdb1 from /dev/md0`),
      d(`# Ora puoi estrarre fisicamente il disco sdb`),
      d(`# Inserisci il disco nuovo (/dev/sdc) — già rilevato come disponibile`),
    ];
  }

  // ── wipefs ────────────────────────────────────────────────────────────────
  if (cmd === "wipefs" && rest.includes("sdc")) {
    if (!st.removedFaulty) return [w(`# Rimuovi prima il disco guasto dall'array`)];
    set(s => ({ ...s, wipedNew: true }));
    return [ok(`/dev/sdc: 8 bytes were erased at offset 0x00000200 (gpt)`)];
  }

  // ── sgdisk / fdisk / parted per sdc ──────────────────────────────────────
  if ((cmd === "sgdisk" || cmd === "fdisk" || cmd === "parted") && rest.includes("sdc")) {
    set(s => ({ ...s, wipedNew: true }));
    return [ok(`/dev/sdc partizionato — sdc1 tipo fd (Linux RAID)`)];
  }

  // ── mdadm --add ───────────────────────────────────────────────────────────
  if (cmd === "mdadm" && rest.includes("--add") && rest.includes("sdc")) {
    if (!st.removedFaulty) return [e(`mdadm: rimuovere prima il disco faulty`)];
    set(s => ({
      ...s,
      addedNew: true,
      arrays: {
        ...s.arrays,
        "/dev/md0": {
          ...arr,
          state: "active, resyncing",
          devs: [...arr.devs.filter(d => !d.dev.includes("sdb")), { dev:"/dev/sdc1", state:"rebuilding" }],
          rebuild: 0,
        }
      }
    }));
    return [
      ok(`mdadm: added /dev/sdc1`),
      ok(`md0 : active raid1 sda1[0] sdc1[2]`),
      w(`      resync in progress`),
      d(`# Rebuild avviato. Monitora: watch cat /proc/mdstat`),
      d(`# Tempo stimato: ~45 min per 500GB`),
    ];
  }

  // ── watch / monitor rebuild ───────────────────────────────────────────────
  if ((cmd === "watch" && rest.includes("mdstat")) || (cmd === "cat" && rest.includes("mdstat") && st.addedNew)) {
    set(s => ({ ...s, checkedArray: true }));
    if (!st.addedNew) return [e(`/proc/mdstat: array degraded, no rebuild`)];
    set(s => ({
      ...s,
      rebuildDone: true,
      arrays: {
        ...s.arrays,
        "/dev/md0": { ...arr, state:"clean", rebuild:100, devs: arr.devs.map(d => d.dev.includes("sdc") ? { ...d, state:"active" } : d) }
      }
    }));
    return [
      ok(`Personalities : [raid1]`),
      ok(`md0 : active raid1 sda1[0] sdc1[1]`),
      ok(`      524224448 blocks super 1.2 [2/2] [UU]`),
      ok(`      bitmap: 0/4 pages [0KB], 65536KB chunk`),
      ok(``),
      ok(`# [UU] = entrambi i dischi attivi e sincronizzati`),
      ok(`# Rebuild completato — array healthy`),
    ];
  }

  // ── lsblk ─────────────────────────────────────────────────────────────────
  if (cmd === "lsblk") {
    set(s => ({ ...s, checkedArray: true }));
    return [
      o(`NAME   MAJ:MIN RM  SIZE RO TYPE  MOUNTPOINT`),
      ok(`sda      8:0    0  500G  0 disk`),
      ok(`└─sda1   8:1    0  500G  0 part`),
      e(`sdb      8:16   0  500G  0 disk  ← FAULTY`),
      e(`└─sdb1   8:17   0  500G  0 part  [F]`),
      st.newDisk ? ok(`sdc      8:32   0  500G  0 disk  ← NUOVO (pronto)`) : null,
      arr?.state === "clean"
        ? ok(`md0      9:0    0  500G  0 raid1 /`)
        : w(`md0      9:0    0  500G  0 raid1 / [degraded]`),
    ].filter(Boolean);
  }

  // ── verify finale ─────────────────────────────────────────────────────────
  if (cmd === "mdadm" && rest.includes("--detail") && st.rebuildDone) {
    set(s => ({ ...s, verified: true }));
    return [
      ok(`/dev/md0:`),
      ok(`            State : clean`),
      ok(`   Active Devices : 2`),
      ok(`  Working Devices : 2`),
      ok(`   Failed Devices : 0`),
      ok(`    Spare Devices : 0`),
      ok(`    Number   Major   Minor   RaidDevice State`),
      ok(`       0       8       1        0      active sync   /dev/sda1`),
      ok(`       1       8       33       1      active sync   /dev/sdc1`),
      ok(`# RAID 1 completamente sincronizzato — ridondanza ripristinata ✅`),
    ];
  }

  // ── universal ─────────────────────────────────────────────────────────────
  if (cmd === "clear") return [{ t:"__CLEAR__", v:"" }];
  if (cmd === "")      return [];

  if (cmd === "hint") {
    const hints = [
      !st.checkedArray   && `cat /proc/mdstat  — stato dell'array`,
      !st.identifiedFault && `mdadm --detail /dev/md0  — identifica il disco faulty`,
      !st.removedFaulty  && `mdadm /dev/md0 --remove /dev/sdb1  — rimuovi logicamente`,
      !st.wipedNew       && `wipefs -a /dev/sdc  — pulisci il nuovo disco`,
      !st.addedNew       && `mdadm /dev/md0 --add /dev/sdc1  — aggiungi al RAID`,
      !st.rebuildDone    && `watch cat /proc/mdstat  — attendi [UU] = rebuild completato`,
      !st.verified       && `mdadm --detail /dev/md0  — verifica stato clean`,
    ].filter(Boolean);
    return hints.length ? [{ t:"warn", v:`💡 ${hints[0]}` }] : [ok(`💡 RAID ripristinato con successo!`)];
  }

  if (cmd === "help") return [
    { t:"head", v:`━━ COMANDI SCENARIO ━━` },
    o(`  cat /proc/mdstat                    — stato live dell'array`),
    o(`  mdadm --detail /dev/md0             — dettagli e disco faulty`),
    o(`  dmesg | grep -i "raid\\|sdb"         — errori kernel`),
    o(`  mdadm /dev/md0 --remove /dev/sdb1  — rimuovi disco guasto`),
    o(`  wipefs -a /dev/sdc                  — pulisci nuovo disco`),
    o(`  mdadm /dev/md0 --add /dev/sdc1     — aggiunge al rebuild`),
    o(`  watch cat /proc/mdstat             — monitora rebuild`),
    o(`  mdadm --detail /dev/md0             — verifica clean`),
    o(`  hint — prossimo passo`),
  ];

  return [e(`-bash: ${cmd}: command not found`)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function Terminal({ scenario, onBack }) {
  const [st, setSt]       = useState(() => scenario.init());
  const [hist, setHist]   = useState([]);
  const [input, setInput] = useState("");
  const [cmdH, setCmdH]   = useState([]);
  const [hidx, setHidx]   = useState(-1);
  const bot = useRef(), inp = useRef();

  const col = { out:"#8abcca", err:"#e06060", ok:"#38bdf8", warn:"#e8a020", prompt:"#5a9acf", dim:"#1a3a4a", head:"#5ad0e8" };

  useEffect(() => { bot.current?.scrollIntoView({ behavior:"smooth" }); }, [hist]);

  useEffect(() => {
    setHist([
      { t:"head", v:`╔══════════════════════════════════════════════════════════════════╗` },
      { t:"head", v:`║  ${scenario.icon}  ${scenario.title.padEnd(62)}║` },
      { t:"head", v:`║  ${scenario.subtitle.padEnd(66)}║` },
      { t:"head", v:`╚══════════════════════════════════════════════════════════════════╝` },
      { t:"out",  v:`` },
      { t:"dim",  v:`📌 ${scenario.bios_note}` },
      { t:"out",  v:`` },
      { t:"warn", v:scenario.desc },
      { t:"out",  v:`` },
      { t:"dim",  v:`'help' → comandi  ·  'hint' → prossimo passo` },
      { t:"out",  v:`` },
    ]);
    inp.current?.focus();
  }, []);

  function submit() {
    const fullInput = input.trim(); if (!fullInput) return;
    setCmdH(h => [fullInput,...h].slice(0,100)); setHidx(-1);

    const cmds = fullInput.split(/\s*&&\s*/).map(s => s.trim()).filter(Boolean);
    const allLines = [{ t:"prompt", v:`[root@server ~]# ${fullInput}` }];
    let currentSt = st;
    let abort = false;

    for (const c of cmds) {
      if (abort) { allLines.push({ t:"dim", v:`# (non eseguito)` }); continue; }
      let pending = currentSt;
      const localSet = fn => { pending = typeof fn === "function" ? fn(pending) : fn; };
      const out = scenario.run(c, currentSt, localSet);
      if (out.some(o => o.t === "__CLEAR__")) { setHist([]); setInput(""); return; }
      allLines.push(...out);
      if (out.some(o => o.t === "err")) abort = true;
      currentSt = pending;
    }

    allLines.push({ t:"out", v:"" });
    setHist(h => [...h, ...allLines]);
    setSt(currentSt);

    // Check solved
    const allDone = scenario.steps.every(s => s.done(currentSt));
    if (allDone && !currentSt.solved) {
      setSt(s => ({ ...s, solved: true }));
      setHist(h => [...h,
        { t:"ok", v:`╔══════════════════════════════════════════════════╗` },
        { t:"ok", v:`║  ✅  SCENARIO COMPLETATO                          ║` },
        { t:"ok", v:`║  ${scenario.title.slice(0,48).padEnd(48)}║` },
        { t:"ok", v:`╚══════════════════════════════════════════════════╝` },
        { t:"out", v:"" },
      ]);
    }
    setInput("");
  }

  function onKey(e) {
    if (e.key==="Enter")     { submit(); return; }
    if (e.key==="ArrowUp")   { e.preventDefault(); const i=Math.min(hidx+1,cmdH.length-1); setHidx(i); setInput(cmdH[i]||""); }
    if (e.key==="ArrowDown") { e.preventDefault(); const i=Math.max(hidx-1,-1); setHidx(i); setInput(i===-1?"":cmdH[i]||""); }
  }

  const steps = scenario.steps;
  const doneCnt = steps.filter(s => s.done(st)).length;
  const pct = Math.round(doneCnt / steps.length * 100);

  return (
    <div style={{ height:"100vh", background:"#050d12", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* titlebar */}
      <div style={{ background:"#080f14", borderBottom:"1px solid #0d2028", padding:"7px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
        </div>
        <span style={{ color:"#1a5a7a", fontSize:11, marginLeft:4 }}>root@server</span>
        <span style={{ color:"#0a2a3a", fontSize:10 }}>{scenario.title}</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:9, background: st.solved?"#0a2030":"#1a0808", color: st.solved?"#38bdf8":"#e06060", padding:"2px 8px", borderRadius:3, border:`1px solid ${st.solved?"#1a5080":"#5a1010"}` }}>
            {st.solved ? "✅ COMPLETATO" : `${pct}% — ${doneCnt}/${steps.length}`}
          </span>
          <button onClick={onBack}
            style={{ padding:"2px 10px", background:"#101828", border:"1px solid #1a2838", borderRadius:4, color:"#4a5a6a", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
            ← Scenari
          </button>
        </div>
      </div>

      {/* progress */}
      <div style={{ padding:"6px 14px", borderBottom:"1px solid #0d2028", background:"#060c12", display:"flex", gap:3, flexWrap:"wrap", flexShrink:0 }}>
        {steps.map((s,i) => {
          const done = s.done(st);
          return (
            <span key={i} style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:done?"#0a1e30":"#060c12", border:`1px solid ${done?"#1a5080":"#0d2028"}`, color:done?"#38bdf8":"#1a3a4a", transition:"all 0.3s" }}>
              {done?"✓":"○"} {s.label}
            </span>
          );
        })}
      </div>

      {/* output */}
      <div onClick={()=>inp.current?.focus()} style={{ flex:1, overflowY:"auto", padding:"12px 16px", cursor:"text" }}>
        {hist.map((l,i) => (
          <div key={i} style={{ color:col[l.t]||"#8abcca", fontSize:12, lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-all", fontWeight:l.t==="head"?"700":"normal" }}>
            {l.v}
          </div>
        ))}
        <div ref={bot}/>
      </div>

      {/* input */}
      <div style={{ borderTop:"1px solid #0d2028", padding:"9px 16px", display:"flex", alignItems:"center", gap:8, background:"#040a10", flexShrink:0 }}>
        <span style={{ color:"#1a5a7a", fontSize:12, whiteSpace:"nowrap" }}>[root@server ~]#</span>
        <input ref={inp} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
          autoFocus spellCheck={false} autoComplete="off"
          style={{ flex:1, background:"none", border:"none", outline:"none", color:"#8abcca", fontFamily:"inherit", fontSize:12.5, caretColor:"#38bdf8" }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [active, setActive] = useState(null);

  if (active !== null) {
    return <Terminal scenario={SCENARIOS[active]} onBack={() => setActive(null)} />;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#050d12", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono','Fira Code',monospace", padding:24 }}>
      <div style={{ maxWidth:720, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:10, letterSpacing:6, color:"#0a2a3a", textTransform:"uppercase", marginBottom:12 }}>Linux SysAdmin · RAID</div>
          <div style={{ fontSize:26, fontWeight:900, color:"#050d12", marginBottom:8 }}>Configurazione RAID.</div>

          <div style={{ background:"#080f14", border:"1px solid #0d2028", borderRadius:8, padding:"12px 18px", marginBottom:8, textAlign:"left", maxWidth:580, margin:"0 auto 20px" }}>
            <div style={{ fontSize:10, color:"#1a4a5a", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Storia</div>
            <div style={{ fontSize:10, color:"#1a3a4a", lineHeight:1.9 }}>
              <div><span style={{color:"#38bdf8"}}>BIOS/POST (anni '90–2000)</span> → Ctrl+H (LSI WebBIOS), Ctrl+R (Dell PERC), F8 (HP Smart Array)</div>
              <div><span style={{color:"#38bdf8"}}>Da OS oggi</span> → <code style={{color:"#38bdf8"}}>storcli64</code> (LSI/Broadcom), <code>arcconf</code> (Adaptec), <code>ssacli</code> (HPE)</div>
              <div><span style={{color:"#38bdf8"}}>RAID Software</span> → <code style={{color:"#38bdf8"}}>mdadm</code> — nessun controller, gestito dal kernel Linux</div>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {SCENARIOS.map((sc, i) => (
            <div key={i} onClick={() => setActive(i)}
              style={{ background:"#080f14", border:"1px solid #0d2028", borderRadius:10, padding:"18px 22px", cursor:"pointer", transition:"all 0.2s" }}
              onMouseOver={e=>e.currentTarget.style.borderColor="#1a5080"}
              onMouseOut={e=>e.currentTarget.style.borderColor="#0d2028"}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{sc.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#38bdf8" }}>{sc.title}</span>
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:"#0a1828", border:`1px solid ${sc.diffColor}`, color:sc.diffColor }}>{sc.difficulty}</span>
                  </div>
                  <div style={{ fontSize:10, color:"#1a4a5a" }}>{sc.subtitle}</div>
                </div>
                <span style={{ color:"#1a4a5a", fontSize:18 }}>›</span>
              </div>
              <div style={{ fontSize:11, color:"#1a3a4a", lineHeight:1.7 }}>{sc.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
