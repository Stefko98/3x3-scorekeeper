"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type AppLanguage = "sr" | "en";

const LANGUAGE_STORAGE_KEY = "courtflow-language";
const LANGUAGE_CHANGE_EVENT = "courtflow-language-change";

const translations: Record<string, string> = {
  "Početna": "Home",
  "Turniri": "Tournaments",
  "Ekipe": "Teams",
  "Igrači": "Players",
  "Utakmice": "Matches",
  "Rezultat uživo": "Live scoring",
  "Tabele": "Standings",
  "Statistika": "Statistics",
  "Javni prikaz": "Public view",
  "Početna strana": "Home page",
  "Jezik": "Language",
  "3x3 Organizator": "3x3 Organizer",
  "Pregled za organizatora": "Organizer overview",
  "Tvoja organizatorska tabla": "Organizer dashboard",
  "Otkazan": "Cancelled",
  "Otkazana": "Cancelled",
  "U pripremi": "Draft",
  "Završen": "Finished",
  "Završena": "Finished",
  "Završene": "Finished",
  "U toku": "In progress",
  "Uživo": "Live",
  "Pauza": "Paused",
  "Pauzirana": "Paused",
  "Zakazana": "Scheduled",
  "Zakazane": "Scheduled",
  "Svi statusi": "All statuses",
  "Sve utakmice": "All matches",
  "Prijave otvorene": "Registration open",
  "Prijave zatvorene": "Registration closed",
  "Potvrđena": "Confirmed",
  "Potvrdjena": "Confirmed",
  "Diskvalifikovana": "Disqualified",
  "Prijavljena": "Registered",
  "Odustala": "Withdrawn",
  "Pregled": "Overview",
  "Podešavanja": "Settings",
  "Grupna faza": "Group stage",
  "Četvrtfinale": "Quarterfinals",
  "Polufinale": "Semifinals",
  "Za treće mesto": "Third-place match",
  "Finale": "Final",
  "Knockout stablo": "Knockout bracket",
  "Eliminacije": "Knockout",
  "Grupe i eliminacije": "Groups and knockout",
  "Grupe + eliminacije": "Groups + knockout",
  "Liga": "League",
  "Šampion": "Champion",
  "Treće mesto": "Third place",
  "Četvrto mesto": "Fourth place",
  "Napravi prvi turnir": "Create the first tournament",
  "Moji turniri": "My tournaments",
  "Stvarni turniri, kapacitet i popunjenost ekipama.": "Tournaments, capacity and team slots.",
  "Upravljaj": "Manage",
  "Napravi turnir": "Create tournament",
  "Kada napravis turnir, ovde će se pojaviti datumi, kapacitet i status.": "After you create a tournament, its dates, capacity and status will appear here.",
  "Jos nema turnira": "No tournaments yet",
  "Još nema turnira": "No tournaments yet",
  "Nema sačuvanih turnira.": "No saved tournaments.",
  "Datum": "Date",
  "Kapacitet": "Capacity",
  "Novi turnir": "New tournament",
  "Osnovni podaci za prvi organizatorski korak.": "Basic information for the first setup step.",
  "Naziv turnira": "Tournament name",
  "Grad": "City",
  "Država": "Country",
  "Lokacija": "Location",
  "Datum početka": "Start date",
  "Datum završetka": "End date",
  "Maks. ekipa": "Max teams",
  "Broj grupa": "Number of groups",
  "Ekipe u knockout-u": "Teams in knockout",
  "Format": "Format",
  "Status": "Status",
  "Opis": "Description",
  "Kratak opis turnira, pravila ili sponzora": "Short tournament description, rules or sponsors",
  "Sačuvaj turnir": "Save tournament",
  "Popuni formu levo i prvi turnir će se pojaviti ovde.": "Complete the form on the left and your first tournament will appear here.",
  "Interni turnir": "Internal tournament",
  "Centar turnira": "Tournament center",
  "Pregled turnira": "Tournament overview",
  "Grupe": "Groups",
  "Bez grupe": "No group",
  "Nema igrača.": "No players.",
  "Prvo rasporedite ekipe po grupama": "Assign teams to groups first",
  "Neraspoređenih ekipa:": "Unassigned teams:",
  "Rasporedi ekipe": "Assign teams",
  "Prikazane su samo utakmice iz ove faze.": "Only matches from this phase are shown.",
  "Nema utakmica za prikaz.": "No matches to display.",
  "Poenteri": "Scorers",
  "Sut za 2": "Two-point shots",
  "Sut za 1": "One-point shots",
  "Asistenti": "Assists",
  "Skakači": "Rebounds",
  "Faulovi": "Fouls",
  "Nema podataka.": "No data.",
  "Format turnira": "Tournament format",
  "Ova pravila odredjuju kako se automatski pravi knockout stablo.": "These rules determine how the knockout bracket is generated automatically.",
  "Prolazi dalje": "Advance",
  "Prva eliminacija": "Opening knockout round",
  "Stablo": "Bracket",
  "Ako knockout već postoji, promena formata će važiti kada kliknes dugme Zameni knockout u tabu Knockout stablo.": "If a knockout already exists, the format change will apply after you click Replace knockout in the Knockout bracket tab.",
  "Zatvori": "Close",
  "Izmeni": "Edit",
  "Obriši": "Delete",
  "Sačuvaj izmene": "Save changes",
  "Odustani": "Cancel",
  "2 ekipe - finale": "2 teams - final",
  "4 ekipe - polufinale": "4 teams - semifinals",
  "8 ekipa - četvrtfinale": "8 teams - quarterfinals",
  "1 grupa": "1 group",
  "2 grupe": "2 groups",
  "4 grupe": "4 groups",
  "2 grupe - A i B": "2 groups - A and B",
  "4 grupe - A, B, C i D": "4 groups - A, B, C and D",
  "Naziv je obavezan.": "Name is required.",
  "Grad je obavezan.": "City is required.",
  "Država je obavezna.": "Country is required.",
  "Lokacija je obavezna.": "Location is required.",
  "Datum početka je obavezan.": "Start date is required.",
  "Datum završetka je obavezan.": "End date is required.",
  "Završetak ne može biti pre početka.": "The end date cannot be before the start date.",
  "Unesi bar 2 ekipe.": "Enter at least 2 teams.",
  "Izaberi broj grupa.": "Select the number of groups.",
  "Za 12 ekipa izaberi 2 ili 4 grupe.": "For 12 teams, select 2 or 4 groups.",
  "Izaberi 2, 4 ili 8 ekipa.": "Select 2, 4 or 8 teams.",
  "Ručno dodavanje ekipa": "Manual team entry",
  "Ekipe se dodaju tek kada postoji turnir.": "Teams can be added after a tournament has been created.",
  "Prvo napravi turnir": "Create a tournament first",
  "Izmena ekipe": "Edit team",
  "Nova ekipa": "New team",
  "Izmeni podatke i sačuvaj promene.": "Edit the details and save your changes.",
  "Svaka ekipa je vezana za izabrani turnir.": "Each team belongs to the selected tournament.",
  "Turnir": "Tournament",
  "Naziv ekipe": "Team name",
  "Grupa": "Group",
  "Broj kapitena": "Captain phone",
  "Broj kapitena:": "Captain phone:",
  "Logo URL": "Logo URL",
  "Status ekipe": "Team status",
  "Sačuvaj ekipu": "Save team",
  "Ekipe za turnir": "Tournament teams",
  "Izaberi turnir": "Select tournament",
  "Dodaj igrače": "Add players",
  "Kada dodas ekipu, pojaviće se ovde i biće dostupna za igrače i utakmice.": "After you add a team, it will appear here and be available for players and matches.",
  "Jos nema ekipa": "No teams yet",
  "Još nema ekipa": "No teams yet",
  "Izaberi turnir.": "Select a tournament.",
  "Turnir je popunio maksimalan broj ekipa.": "The tournament has reached its team capacity.",
  "Naziv ekipe je obavezan.": "Team name is required.",
  "Ekipa sa tim nazivom već postoji na turniru.": "A team with that name already exists in this tournament.",
  "Grupa može biti samo": "Group can only be",
  "Spisak igrača": "Player roster",
  "3+ igrača": "3+ players",
  "Bez igrača": "No players",
  "Prvo dodaj ekipe": "Add teams first",
  "Izmena igrača": "Edit player",
  "Novi igrač": "New player",
  "Igrač se čuva u izabranoj ekipi.": "The player will be saved to the selected team.",
  "Ekipa": "Team",
  "Ime": "First name",
  "Prezime": "Last name",
  "URL slike": "Photo URL",
  "Sačuvaj igrača": "Save player",
  "Spiskovi igrača": "Player rosters",
  "Zakaži utakmice": "Schedule matches",
  "Spremno": "Ready",
  "Dodaj jos": "Add more",
  "Dodaj još": "Add more",
  "Nema igrača u ovoj ekipi.": "No players on this team.",
  "Izaberi ekipu.": "Select a team.",
  "Ime je obavezno.": "First name is required.",
  "Prezime je obavezno.": "Last name is required.",
  "Raspored": "Schedule",
  "Nova utakmica": "New match",
  "Zakaži utakmicu i posle je otvori u rezultatu uživo.": "Schedule a match, then open it in live scoring.",
  "Ekipa A": "Team A",
  "Ekipa B": "Team B",
  "Vreme": "Time",
  "Faza utakmice": "Match phase",
  "Sačuvaj utakmicu": "Save match",
  "Automatske grupne utakmice": "Automatic group matches",
  "Napravi grupne utakmice": "Create group matches",
  "Postojece": "Existing",
  "Postojeće": "Existing",
  "Nove": "New",
  "Automatski knockout": "Automatic knockout",
  "Zameni knockout": "Replace knockout",
  "Napravi knockout": "Create knockout",
  "Grupne": "Group matches",
  "Faza": "Phase",
  "Zakljucano": "Locked",
  "Zaključano": "Locked",
  "Nema utakmica u ovoj fazi.": "No matches in this phase.",
  "Čeka ekipe": "Waiting for teams",
  "Izaberi ekipu A.": "Select team A.",
  "Izaberi ekipu B.": "Select team B.",
  "Ekipe moraju biti razlicite.": "Teams must be different.",
  "Vreme je obavezno.": "Time is required.",
  "Prvo rasporedite ekipe po grupama.": "Assign teams to groups first.",
  "Dodaj bar dve ekipe.": "Add at least two teams.",
  "Nema grupe sa najmanje dve ekipe.": "No group has at least two teams.",
  "Sve grupne utakmice su već napravljene.": "All group matches have already been created.",
  "Prvo napravi utakmice grupne faze.": "Create the group-stage matches first.",
  "Završi sve utakmice grupne faze.": "Finish all group-stage matches.",
  "Spremno za četvrtfinale.": "Ready for the quarterfinals.",
  "Spremno za polufinale.": "Ready for the semifinals.",
  "Spremno za finale.": "Ready for the final.",
  "Knockout već ima zapocete ili završene utakmice.": "The knockout already has started or finished matches.",
  "Knockout već postoji. Mozes da ga zamenis pravilnim rasporedom.": "A knockout already exists. You can replace it with the correct bracket.",
  "Čeka utakmicu": "Waiting for match",
  "Prošao": "Advanced",
  "Prosao": "Advanced",
  "Ispao": "Eliminated",
  "Čeka": "Pending",
  "Čeka šampiona": "Waiting for champion",
  "Čeka protivnika": "Waiting for opponent",
  "Nepoznata ekipa": "Unknown team",
  "Rezultat uživo radi sa pravim utakmicama. Prvo napravi utakmicu u modulu Utakmice.": "Live scoring uses scheduled matches. Create a match in the Matches module first.",
  "Nema utakmica za rezultat uživo": "No matches available for live scoring",
  "Proveri utakmice": "View matches",
  "Nema utakmice koju možeš da izaberes za rezultat uživo.": "There is no match available for live scoring.",
  "Nema utakmica": "No matches",
  "Pokreni": "Start",
  "Nastavi": "Resume",
  "Završi": "Finish",
  "Ova utakmica će biti spremna kada se pobednici prethodne runde automatski upisu u stablo.": "This match will be ready when the winners of the previous round are added to the bracket automatically.",
  "Preuzmi kontrolu ove utakmice": "Take control of this match",
  "Vođenje rezultata": "Scorekeeping",
  "Rezultat": "Score",
  "Dodaj igrače da bi imao dugmad za poene i statistiku.": "Add players to enable scoring and statistics controls.",
  "Faul": "Foul",
  "Asist": "Assist",
  "Skok": "Rebound",
  "Dres": "Jersey",
  "Nadimak": "Nickname",
  "Unesi nadimak": "Enter nickname",
  "Rezultat je nerešen": "The score is tied",
  "Proverite kraj produžetka": "Review overtime finish",
  "Regularno vreme je isteklo": "Regulation time has expired",
  "Dostignut je limit od 21 poena": "The 21-point limit has been reached",
  "Potvrda zapisničara": "Scorekeeper confirmation",
  "Trenutni rezultat je": "The current score is",
  ". Možete prvo dodati propušten poen, faul, asistenciju ili skok.": ". You can add a missed point, foul, assist or rebound before confirming.",
  "Ne još, nastavi unos": "Not yet, keep entering events",
  "Nastavi unos": "Keep entering events",
  "Pokreni produžetak": "Start overtime",
  "Potvrdi kraj utakmice": "Confirm match finish",
  "Produžetak": "Overtime",
  "Reset": "Reset",
  "Prvi do": "First to",
  "Faulovi A": "Team A fouls",
  "Faulovi B": "Team B fouls",
  "Zapisnik": "Scorebook",
  "Ponisti poslednje": "Undo last",
  "Poništi poslednje": "Undo last",
  "Zapisnik je prazan dok ne startujes utakmicu ili uneses prvi događaj.": "The scorebook is empty until you start the match or enter the first event.",
  "Igrač": "Player",
  "Događaj": "Event",
  "Bez ekipe": "No team",
  "Ispravka događaja": "Event correction",
  "Nepoznat igrač": "Unknown player",
  "Rezultat je izjednačen.": "The score is tied.",
  "Utakmica je pokrenuta": "Match started",
  "Utakmica je pauzirana": "Match paused",
  "Utakmica je nastavljena": "Match resumed",
  "Utakmica je završena posle potvrde zapisničara.": "Match finished after scorekeeper confirmation.",
  "Početak utakmice": "Match start",
  "Nastavak utakmice": "Match resumed",
  "Početak produžetka": "Overtime started",
  "Kraj utakmice": "Match finished",
  "Asistencija": "Assist",
  "Statistika iz zapisnika": "Scorebook statistics",
  "Statistika igrača": "Player statistics",
  "Mečevi": "Matches",
  "Događaji": "Events",
  "Nema turnira": "No tournament",
  "Nema statistike za ovaj prikaz": "No statistics for this view",
  "Najbolji po statističkim kategorijama": "Category leaders",
  "Najbolji igrači turnira": "Best tournament players",
  "Nema dovoljno podataka za MVP rang-listu.": "There is not enough data for the MVP ranking.",
  "Najbolje pojedinačne partije": "Best individual performances",
  "Rekordi će se pojaviti posle prvih statističkih unosa.": "Records will appear after the first statistical events are entered.",
  "Kompletna statistika": "Complete statistics",
  "Svi igrači": "All players",
  "Detalji igrača": "Player details",
  "Zatvori detalje igrača": "Close player details",
  "Statistika ekipa": "Team statistics",
  "Učinak ekipa": "Team performance",
  "Poeni": "Points",
  "Skokovi": "Rebounds",
  "Indeks": "Index",
  "MVP indeks": "MVP index",
  "P / meč": "PPG",
  "A / meč": "APG",
  "S / meč": "RPG",
  "Najbolji poenteri": "Top scorers",
  "Broj pogođenih šuteva za dva poena.": "Made two-point shots.",
  "Najbolji za 2 poena": "Two-point leaders",
  "Broj pogođenih šuteva za jedan poen.": "Made one-point shots.",
  "Najbolji za 1 poen": "One-point leaders",
  "Broj upisanih asistencija iz live zapisnika.": "Assists recorded in the live scorebook.",
  "Najbolji asistenti": "Assist leaders",
  "Broj upisanih skokova iz live zapisnika.": "Rebounds recorded in the live scorebook.",
  "Najbolji skakači": "Rebound leaders",
  "Broj faulova koji nisu obrisani.": "Fouls that have not been deleted.",
  "Najviše faulova": "Foul leaders",
  "Nema podataka za ovu kategoriju.": "No data for this category.",
  "Ukupno": "Total",
  "Poredak ekipa": "Team standings",
  "Odigrano": "Played",
  "Lider": "Leader",
  "Tabela se pravi iz ekipa i završenih utakmica.": "The standings are calculated from teams and finished matches.",
  "Nema ekipa za tabelu": "No teams for the standings",
  "Kada dodas ekipe, tabela će prikazati poredak za taj turnir.": "After you add teams, the standings will show their ranking.",
  "Forma turnira": "Tournament structure",
  "Knockout": "Knockout",
  "Ukupno poena": "Total points",
  "Rezultati": "Results",
  "Završene utakmice iz grupne faze koje ulaze u tabelu.": "Finished group-stage matches included in the standings.",
  "Jos nema rezultata": "No results yet",
  "Još nema rezultata": "No results yet",
  "Završi utakmicu da se pojavi u tabeli.": "Finish a match for it to appear in the standings.",
  "Poredak po završenim utakmicama.": "Ranking based on finished matches.",
  "Dato": "Scored",
  "Primlj.": "Allowed",
  "Bod": "Pts",
  "Samo prikaz, bez unosa": "View only",
  "Javni prikaz rezultata": "Public results",
  "Nema turnira za javni prikaz.": "No tournament available for public view.",
  "Završeno": "Finished",
  "Sada se igra": "Live now",
  "aktivno": "active",
  "Faza turnira": "Tournament phase",
  "Bez termina": "Time not set",
  "Sinhronizacija povezana": "Synchronization connected",
  "Nema veze sa bazom": "No database connection",
  "Provera sinhronizacije": "Checking synchronization",
  "Baza:": "Database:",
  "Da li ste sigurni da zelite da obrisete?": "Are you sure you want to delete this?",
  "poena": "points",
  "faulova": "fouls",
  "asist.": "assists",
  "skok.": "rebounds",
  "igrača": "players",
  "ekipa": "teams",
  "utakmica": "matches",
  "utakmice": "matches",
  "novih": "new",
  "unosa": "entries",
  "protiv": "vs",
  "Počinje produžetak. Pobeđuje ekipa koja prva postigne": "Overtime begins. The first team to score",
  "poena.": "points wins.",
  "čeka protivnike": "is waiting for opponents",
  "Ekipe su već rasporedjene u": "Teams are already assigned to",
  "grupe, pa aplikacija koristi stvarni raspored grupa umesto starog sačuvanog podešavanja.": "groups, so the app uses the actual group assignment instead of the old saved setting.",
  "Turniri | 3x3 Organizator": "Tournaments | 3x3 Organizer",
  "Ekipe | 3x3 Organizator": "Teams | 3x3 Organizer",
  "Igrači | 3x3 Organizator": "Players | 3x3 Organizer",
  "Utakmice | 3x3 Organizator": "Matches | 3x3 Organizer",
  "Rezultat uživo | 3x3 Organizator": "Live scoring | 3x3 Organizer",
  "Tabele | 3x3 Organizator": "Standings | 3x3 Organizer",
  "Statistika igrača | 3x3 Organizator": "Player statistics | 3x3 Organizer",
  "Javni prikaz | 3x3 Organizator": "Public view | 3x3 Organizer",
};

const LanguageContext = createContext<{
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (text: string) => string;
}>({
  language: "sr",
  setLanguage: () => undefined,
  t: (text) => text,
});

const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["aria-label", "placeholder", "title"] as const;

function translateCore(text: string): string {
  const exactTranslation = translations[text];
  if (exactTranslation) return exactTranslation;

  const manuallyAdded = text.match(/^(\d+) ručno dodatih ekipa$/);
  if (manuallyAdded) return `${manuallyAdded[1]} manually added teams`;

  const readyRosters = text.match(/^(\d+) ekipa ima 3\+ igrača$/);
  if (readyRosters) return `${readyRosters[1]} teams have 3+ players`;

  const matchStatusCount = text.match(/^(\d+) završenih \/ (\d+) uživo$/);
  if (matchStatusCount) {
    return `${matchStatusCount[1]} finished / ${matchStatusCount[2]} live`;
  }

  const nicknameLabel = text.match(/^Nadimak za (.+)$/);
  if (nicknameLabel) return `Nickname for ${nicknameLabel[1]}`;

  const matchLabel = text.match(/^(.+) \/ (.+) protiv (.+)$/);
  if (matchLabel) {
    return `${translateCore(matchLabel[1])} / ${matchLabel[2]} vs ${matchLabel[3]}`;
  }

  const insufficientTeams = text.match(
    /^Nema dovoljno ekipa za knockout format od (\d+) ekipa\.$/,
  );
  if (insufficientTeams) {
    return `There are not enough teams for a ${insufficientTeams[1]}-team knockout format.`;
  }

  const bracketReady = text.match(/^(.+) Stablo će se napraviti automatski\.$/);
  if (bracketReady) {
    return `${translateCore(bracketReady[1])} The bracket will be created automatically.`;
  }

  const performanceOpponent = text.match(/^(.+) · protiv (.+)$/);
  if (performanceOpponent) {
    return `${translateCore(performanceOpponent[1])} · vs ${performanceOpponent[2]}`;
  }

  const unassignedTeams = text.match(/^Neraspoređenih ekipa: (\d+)\.$/);
  if (unassignedTeams) return `Unassigned teams: ${unassignedTeams[1]}.`;

  const groupSuffix = text.match(/^\/ Grupa ([A-Z0-9]+)$/);
  if (groupSuffix) return `/ Group ${groupSuffix[1]}`;

  const validGroups = text.match(/^Grupa može biti samo (.+)\.$/);
  if (validGroups) return `Group can only be ${validGroups[1]}.`;

  const minimumTeams = text.match(
    /^Ne može manje od (\d+), jer toliko ekipa već postoji\.$/,
  );
  if (minimumTeams) {
    return `It cannot be less than ${minimumTeams[1]}, because that many teams already exist.`;
  }

  const groupMatch = text.match(/^Grupa ([A-Z0-9]+)$/);
  if (groupMatch) return `Group ${groupMatch[1]}`;

  const roundMatch = text.match(
    /^(Grupna faza|Četvrtfinale|Polufinale|Finale|Za treće mesto) (\d+)$/,
  );
  if (roundMatch) {
    return `${translations[roundMatch[1]] ?? roundMatch[1]} ${roundMatch[2]}`;
  }

  const countMatch = text.match(
    /^(\d+) (ekipa|igrača|utakmica|utakmice|poena|faulova|asist\.|skok\.|unosa|novih)$/,
  );
  if (countMatch) {
    const countLabels: Record<string, string> = {
      ekipa: "teams",
      igrača: "players",
      utakmica: "matches",
      utakmice: "matches",
      poena: "points",
      faulova: "fouls",
      "asist.": "assists",
      "skok.": "rebounds",
      unosa: "entries",
      novih: "new",
    };
    return `${countMatch[1]} ${countLabels[countMatch[2]]}`;
  }

  const readyMatches = text.match(/^Spremno za (\d+) grupnih utakmica\.$/);
  if (readyMatches) return `Ready to create ${readyMatches[1]} group matches.`;

  const firstTo = text.match(/^Prvi do (\d+) poena\.$/);
  if (firstTo) return `First to ${firstTo[1]} points.`;

  const waitingTeam = text.match(/^(.+) čeka protivnike$/);
  if (waitingTeam) return `${waitingTeam[1]} is waiting for opponents`;

  const groupBreadcrumb = text.match(/^(.+) \/ Grupa ([A-Z0-9]+)$/);
  if (groupBreadcrumb) return `${groupBreadcrumb[1]} / Group ${groupBreadcrumb[2]}`;

  const versus = text.match(/^(.+) protiv (.+)$/);
  if (versus) return `${versus[1]} vs ${versus[2]}`;

  return text;
}

export function translateToEnglish(text: string) {
  const whitespace = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!whitespace) return translateCore(text);
  return `${whitespace[1]}${translateCore(whitespace[2])}${whitespace[3]}`;
}

function shouldSkipTextNode(node: Text) {
  const tagName = node.parentElement?.tagName;
  return tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT";
}

function translateTextNode(node: Text, language: AppLanguage) {
  if (shouldSkipTextNode(node)) return;

  const current = node.data;
  let source = textSources.get(node);

  if (!source) {
    source = current;
    textSources.set(node, source);
  } else if (language === "en") {
    const previousTranslation = translateToEnglish(source);
    if (current !== source && current !== previousTranslation) {
      source = current;
      textSources.set(node, source);
    }
  } else if (current !== source && current !== translateToEnglish(source)) {
    source = current;
    textSources.set(node, source);
  }

  const nextValue = language === "en" ? translateToEnglish(source) : source;
  if (current !== nextValue) node.data = nextValue;
}

function translateElementAttributes(element: Element, language: AppLanguage) {
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map<string, string>();
    attributeSources.set(element, sources);
  }

  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;

    let source = sources.get(attribute);
    if (!source) {
      source = current;
      sources.set(attribute, source);
    } else if (language === "en") {
      const previousTranslation = translateToEnglish(source);
      if (current !== source && current !== previousTranslation) {
        source = current;
        sources.set(attribute, source);
      }
    } else if (current !== source && current !== translateToEnglish(source)) {
      source = current;
      sources.set(attribute, source);
    }

    const nextValue = language === "en" ? translateToEnglish(source) : source;
    if (current !== nextValue) element.setAttribute(attribute, nextValue);
  }
}

function translateTree(root: Node, language: AppLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttributes(root as Element, language);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text, language);
    } else {
      translateElementAttributes(node as Element, language);
    }
    node = walker.nextNode();
  }
}

function readLanguage(): AppLanguage {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" ? "en" : "sr";
}

function subscribeToLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore<AppLanguage>(
    subscribeToLanguage,
    readLanguage,
    () => "sr",
  );

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;

    const root = document.documentElement;
    translateTree(root, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text, language);
          continue;
        }

        if (mutation.type === "attributes") {
          translateElementAttributes(mutation.target as Element, language);
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          translateTree(addedNode, language);
        }
      }
    });

    observer.observe(root, {
      attributeFilter: [...translatedAttributes],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);
    const originalConfirm = window.confirm.bind(window);

    window.alert = (message?: unknown) =>
      originalAlert(
        language === "en" && typeof message === "string"
          ? translateToEnglish(message)
          : message,
      );
    window.confirm = (message?: string) =>
      originalConfirm(
        language === "en" && typeof message === "string"
          ? translateToEnglish(message)
          : message,
      );

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [language]);

  const t = useCallback(
    (text: string) => (language === "en" ? translateToEnglish(text) : text),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      aria-label={t("Jezik")}
      className="mt-5 border-t border-white/10 pt-4 lg:mt-auto"
      role="group"
    >
      <p className="mb-2 text-[11px] font-black uppercase text-[#64748B]">
        {t("Jezik")}
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-[#0F172A] p-1">
        <LanguageButton
          active={language === "sr"}
          label="SRB"
          onClick={() => setLanguage("sr")}
        />
        <LanguageButton
          active={language === "en"}
          label="ENG"
          onClick={() => setLanguage("en")}
        />
      </div>
    </div>
  );
}

function LanguageButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`h-9 rounded-sm border text-xs font-black transition ${
        active
          ? "border-[#F97316] bg-[#F97316] text-[#111827]"
          : "border-transparent text-[#94A3B8] hover:border-white/15 hover:bg-white/5 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
