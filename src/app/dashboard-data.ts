export type StatusTone = "green" | "orange" | "yellow" | "red" | "blue";

export type StatCard = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

export type PlayerLine = {
  number: number;
  name: string;
  points: number;
  fouls: number;
};

export type TeamLine = {
  name: string;
  city: string;
  score: number;
  fouls: number;
  players: PlayerLine[];
};

export type LiveMatch = {
  tournament: string;
  court: string;
  clock: string;
  status: "LIVE" | "PAUSED" | "SCHEDULED" | "FINISHED";
  teamA: TeamLine;
  teamB: TeamLine;
  events: string[];
};

export type ScheduleItem = {
  time: string;
  court: string;
  match: string;
  phase: string;
  status: string;
};

export type StandingRow = {
  rank: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  points: string;
  diff: string;
};

export const stats: StatCard[] = [
  {
    label: "Aktivni turniri",
    value: "4",
    detail: "2 danas pocinju",
    tone: "orange",
  },
  {
    label: "Live utakmice",
    value: "3",
    detail: "2 terena zauzeta",
    tone: "green",
  },
  {
    label: "Registrovane ekipe",
    value: "48",
    detail: "12 ceka potvrdu",
    tone: "yellow",
  },
  {
    label: "Uneti igraci",
    value: "186",
    detail: "31.8 ppg top tim",
    tone: "blue",
  },
];

export const liveMatch: LiveMatch = {
  tournament: "Downtown 3x3 Classic",
  court: "Court 1",
  clock: "06:42",
  status: "LIVE",
  teamA: {
    name: "Belgrade Wolves",
    city: "Belgrade",
    score: 12,
    fouls: 4,
    players: [
      { number: 7, name: "Marko Markovic", points: 6, fouls: 1 },
      { number: 11, name: "Nikola Petrovic", points: 4, fouls: 2 },
      { number: 23, name: "Stefan Jovanovic", points: 2, fouls: 1 },
    ],
  },
  teamB: {
    name: "Novi Sad Tigers",
    city: "Novi Sad",
    score: 9,
    fouls: 3,
    players: [
      { number: 3, name: "Luka Ilic", points: 5, fouls: 1 },
      { number: 9, name: "Petar Simic", points: 2, fouls: 1 },
      { number: 15, name: "Ivan Kostic", points: 2, fouls: 1 },
    ],
  },
  events: [
    "06:58  Marko Markovic  +1",
    "07:14  Luka Ilic  +2",
    "07:36  Nikola Petrovic  Foul",
    "08:02  Stefan Jovanovic  +2",
  ],
};

export const schedule: ScheduleItem[] = [
  {
    time: "14:20",
    court: "Court 2",
    match: "Zemun Blocks vs Kragujevac Lions",
    phase: "Group A",
    status: "Scheduled",
  },
  {
    time: "14:40",
    court: "Court 1",
    match: "Nis Force vs Pancevo Heat",
    phase: "Group B",
    status: "Scorekeeper ready",
  },
  {
    time: "15:10",
    court: "Court 3",
    match: "A1 vs B2",
    phase: "Semi Final",
    status: "Pending teams",
  },
];

export const standings: StandingRow[] = [
  {
    rank: 1,
    team: "Belgrade Wolves",
    played: 3,
    wins: 3,
    losses: 0,
    points: "57:39",
    diff: "+18",
  },
  {
    rank: 2,
    team: "Novi Sad Tigers",
    played: 3,
    wins: 2,
    losses: 1,
    points: "49:44",
    diff: "+5",
  },
  {
    rank: 3,
    team: "Nis Force",
    played: 3,
    wins: 1,
    losses: 2,
    points: "42:50",
    diff: "-8",
  },
  {
    rank: 4,
    team: "Pancevo Heat",
    played: 3,
    wins: 0,
    losses: 3,
    points: "36:51",
    diff: "-15",
  },
];

export const modules = [
  "Dashboard",
  "Turniri",
  "Ekipe",
  "Igraci",
  "Utakmice",
  "Live Score",
  "Tabele",
  "Public Viewer",
  "Audit Log",
];
