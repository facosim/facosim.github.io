/* "Of The Day": one item per category, chosen by the calendar date, so
   everyone sees the same set on a given day and it changes at midnight.
   Each entry is { t: title, d: short description shown on hover, u: link }. */
(function () {
  'use strict';

  var AOPA = 'https://www.aopa.org/';
  var AFH = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook/media/19_afh_ch17.pdf';
  var SKY = 'https://www.skybrary.aero/index.php/';
  var WIKI = 'https://en.wikipedia.org/wiki/';
  var CFR14 = 'https://www.ecfr.gov/current/title-14/section-';
  var PCG = 'https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/glossary-';
  var HANDBOOK = 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook';

  // ---------- Emergency procedure ----------
  var EMERG = [
    { t: 'Aircraft Fires', d: 'Engine, electrical and cabin fires: what each one looks like, the memory items, and why getting on the ground fast matters.', u: AOPA + 'training-and-safety/students/flighttestprep/skills/aircraft-fires' },
    { t: 'Fire in Flight', d: 'Fighting a cockpit fire: cut the source, use the extinguisher, ventilate, and land as soon as possible.', u: AOPA + 'news-and-media/all-news/2020/february/24/aircraft-maintenance-fighting-a-cockpit-fire' },
    { t: 'Immediate Action Items', d: 'The handful of checklist steps you must know from memory because there is no time to read them.', u: AOPA + 'news-and-media/all-news/2020/february/03/training-tip-immediate-action-items' },
    { t: 'Oil in the Cockpit', d: 'Fuel or oil fumes and spray in the cabin: likely sources, the fire risk, and how to handle it.', u: AOPA + 'news-and-media/all-news/2020/july/27/aircraft-maintenance-fuel-and-oil-in-the-cockpit' },
    { t: 'Engine Control Cable Failure', d: 'A broken throttle, mixture or prop cable: what the engine does and how to fly the airplane to a landing.', u: AOPA + 'news-and-media/all-news/2021/february/09/aircraft-maintenance-engine-control-cable-failures' },
    { t: 'Trapped in Icing', d: 'Inadvertent airframe ice: recognising it early, the escape options, and flying the approach with ice on the wing.', u: AOPA + 'news-and-media/all-news/2021/january/14/trapped-in-ice' },
    { t: 'Ditching Over Water', d: 'Planning a water landing: configuration, touchdown along the swell, and getting out of the airplane afterwards.', u: AOPA + 'news-and-media/all-news/2017/september/pilot/ditching-ditching' },
    { t: 'Battery Loss', d: 'Electrical malfunctions: load shedding, what still works without the battery, and landing with no electrics.', u: AOPA + 'training-and-safety/students/flighttestprep/skills/electrical-malfunctions' },
    { t: 'Generator Loss', d: 'Alternator or generator failure: how long the battery lasts, what to turn off, and where to land.', u: AOPA + 'training-and-safety/students/flighttestprep/skills/electrical-malfunctions' },
    { t: 'Forced Landing', d: 'Airplane Flying Handbook chapter 17: picking a field, the approach, and the touchdown with the engine out.', u: AFH },
    { t: 'Engine Failure After Takeoff', d: 'The impossible turn: pitch for best glide, land ahead within about 30 degrees, and never stall it in.', u: AFH },
    { t: 'Emergency Descent', d: 'Getting down fast for fire or smoke: power idle, gear and flaps as allowed, bank to keep the nose down.', u: AFH },
    { t: 'Loss of Elevator Control', d: 'Flying pitch with trim and power when the elevator is jammed or disconnected.', u: AFH },
    { t: 'Asymmetric Flap', d: 'One flap extends and the other does not: the roll, the recovery, and the higher approach speed.', u: AFH },
    { t: 'Landing Gear Failure', d: 'Gear that will not extend or lock: the checklist, the emergency extension, and the gear-up landing.', u: SKY + 'Landing_Gear_Problems:_Guidance_for_Flight_Crews' },
    { t: 'Door Opening in Flight', d: 'A door pops open after rotation: it is noisy, not dangerous. Fly the airplane and come back to land.', u: AFH },
    { t: 'VFR into IMC', d: 'Inadvertent flight into cloud: the 180-degree turn on instruments and asking ATC for help early.', u: AFH },
    { t: 'Electrical Fires', d: 'The smell of hot insulation: master off, extinguisher, then bring essential equipment back one item at a time.', u: AFH },
    { t: 'Engine Fires', d: 'Fire on start or in flight: mixture cut, fuel off, and the dive that may blow the fire out.', u: AFH },
    { t: 'Bird Strike on Final', d: 'Birds at low altitude: the damage they do, the go-around decision, and landing with a cracked windshield.', u: SKY + 'Bird_Strike_on_Final_Approach:_Guidance_for_Flight_Crews' },
    { t: 'Volcanic Ash', d: 'Ash clouds do not show on radar: the signs of an encounter and the 180-degree turn out of it.', u: SKY + 'Volcanic_Ash:_Guidance_for_Flight_Crews' },
    { t: 'Medical Emergencies', d: 'A sick passenger or pilot: priorities, diversion, and what to tell ATC.', u: SKY + 'Medical_Emergencies_-_Guidance_for_Flight_Crew' },
    { t: 'Mountain Terrain Escape', d: 'Escape routes when you cannot outclimb rising terrain: turn early toward lower ground.', u: SKY + 'Mountainous_Terrain_Escape_Routes' },
    { t: 'Brake Problems', d: 'Brake failure or a hot brake on landing: steering, the overrun, and what ATC needs to know.', u: SKY + 'Brake_Problems:_Guidance_for_Controllers' },
    { t: 'Evacuation After Landing', d: 'Getting everyone out after an emergency landing: when to go, which exits, and moving upwind.', u: SKY + 'Emergency_Evacuation_on_Land' },
    { t: 'Emergency Turn', d: 'The engine-out turn procedure that keeps you clear of terrain after takeoff.', u: SKY + 'Emergency_Turn' },
    { t: 'Fuel Dumping', d: 'When and where to jettison fuel to get down to landing weight, and coordinating it with ATC.', u: SKY + 'Fuel_Dumping:_Guidance_for_Flight_Crews' },
    { t: 'Hydraulic Problems', d: 'Losing a hydraulic system: what you lose with it (gear, flaps, brakes, steering) and the backups.', u: SKY + 'Hydraulic_Problems:_Guidance_for_Flight_Crews' },
    { t: 'System Wide Events', d: 'Failures that hit many aircraft at once, such as a GPS outage or an ATC system failure.', u: SKY + 'System_Wide_Events:_Guidance_for_Flight_Crews' },
    { t: 'First Seconds in an Emergency', d: 'First, do no harm: aviate, buy time, and do not make a bad situation worse with a hurried action.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/first-do-no-harm' },
    { t: 'Rules to Live By', d: 'AOPA Air Safety Institute’s short list of rules that keep an emergency survivable.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/rules-to-live-by' },
    { t: 'Vacuum Pump Failure', d: 'The attitude indicator dies slowly: catching it with the cross-check and flying partial panel.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/other-emergencies' },
    { t: 'Electrical Failure', d: 'Total electrical failure: no radios, no flaps, no lights. Squawk, land, and signal the tower.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/other-emergencies' },
    { t: 'Weather Emergencies', d: 'Thunderstorms, ice and low cloud as emergencies: the decisions that keep you out of them.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/weather' },
    { t: 'Survival After a Forced Landing', d: 'After the landing: stay with the airplane, signal, shelter and water.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/survival' },
    { t: 'Fire', d: 'ASI Safety Spotlight: in-flight fire from ignition to landing, with real accident examples.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/fire' },
    { t: 'Engine Failure in Flight', d: 'Best glide, restart flow, field selection and the mayday call, in that order.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/engine-failure' },
    { t: 'Forced Landings', d: 'ASI Safety Spotlight: choosing a field, the pattern, and the touchdown that lets everyone walk away.', u: AOPA + 'training-and-safety/online-learning/safety-spotlights/emergency-procedures/forced-landings' }
  ];

  // ---------- Mishap ----------
  var MISHAP = [
    { t: 'Tenerife, 1977', d: 'Two 747s collided on a fog-bound runway after a takeoff begun without clearance. 583 died, the deadliest accident in aviation.', u: SKY + 'B742_/_B741,_Tenerife_Canary_Islands_Spain,_1977' },
    { t: 'ATR 42, Lubbock, 2009', d: 'A cargo ATR 42 in icing conditions stalled short of the runway after a flap problem on approach. Both pilots survived.', u: SKY + 'AT43,_Lubbock_TX_USA,_2009' },
    { t: '737-300, Amsterdam, 2010', d: 'A Boeing 737-300 serious incident at Schiphol. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'B733,_Amsterdam_Netherlands,_2010' },
    { t: '747s, Chicago O’Hare, 1999', d: 'A departing 747 lifted off over another 747 that had crossed the active runway in a runway incursion at night.', u: SKY + 'B742_/_B744,_Chicago_O%27Hare_IL_USA,_1999' },
    { t: 'Dash 8, Toronto, 2019', d: 'A Dash 8 taxiing at Toronto Pearson collided with a fuel truck at a taxiway intersection.', u: SKY + 'DH8C,_Toronto_Canada,_2019' },
    { t: 'E170, Frankfurt, 2005', d: 'An Embraer 170 serious incident at Frankfurt. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'E170,_Frankfurt_Germany,_2005' },
    { t: 'Milan Linate, 2001', d: 'An MD-87 on takeoff roll in fog hit a Citation that had taxied onto the runway. 118 died. Ground radar was not working.', u: SKY + 'MD87_/_C525,_Milan_Linate,_2001' },
    { t: 'MD-82, Little Rock, 1999', d: 'American 1420 landed in a thunderstorm with the spoilers unarmed and ran off the end of the runway. 11 died.', u: SKY + 'MD82,_Little_Rock_USA,_1999' },
    { t: 'Saab 340, New York JFK, 1999', d: 'A Saab 340 serious incident at JFK. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'SF34,_New_York_JFK,_1999' },
    { t: 'A320, Liverpool, 2018', d: 'An Airbus A320 serious incident at Liverpool. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'A320,_Liverpool_UK,_2018' },
    { t: 'A320, Northern Ireland, 2006', d: 'An Airbus A320 serious incident over Northern Ireland. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'A320,_Northern_Ireland,_2006' },
    { t: 'A320 and CRJ, Sofia, 2007', d: 'A loss of separation between a departing A320 and a CRJ at Sofia. Read the SKYbrary summary.', u: SKY + 'A320_/_CRJ2,_Sofia_Bulgaria,_2007' },
    { t: '737-300, Chambéry, 2012', d: 'A 737 on the demanding mountain approach into Chambéry. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'B733,_Chambery_France,_2012' },
    { t: '787 and C172, Madrid, 2017', d: 'A near miss between a Boeing 787 and a Cessna 172 near Madrid. Read the SKYbrary summary.', u: SKY + 'B789_/_C172,_Madrid_Spain,_2017' },
    { t: '777, Manchester, 2005', d: 'A Boeing 777 serious incident at Manchester. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'B772,_Manchester_UK,_2005' },
    { t: '767 en route, New York, 2000', d: 'A Boeing 767 serious incident en route near New York. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'B763,_en-route,_New_York_NY_USA,_2000' },
    { t: 'Challenger, Birmingham, 2002', d: 'A Challenger 604 rolled over and crashed on takeoff with frost on the wings. Five died. Wing ice is never acceptable.', u: SKY + 'CL60,_Birmingham_UK,_2002' },
    { t: 'DC-10, Sioux City, 1989', d: 'United 232 lost all hydraulics after an uncontained engine failure and was flown with throttles alone. 184 of 296 survived.', u: SKY + 'DC10,_Sioux_City_USA,_1989' },
    { t: 'DC-10, Newburgh, 1996', d: 'A FedEx DC-10 with an in-flight cargo fire made an emergency landing at Stewart. All escaped; the aircraft burned out.', u: SKY + 'DC10,_Newburgh_NY_USA,_1996' },
    { t: 'E190, Lisbon, 2018', d: 'An Embraer 190 became barely controllable after maintenance left the aileron controls miswired. The crew landed it at Beja.', u: SKY + 'E190,_Lisbon_Portugal,_2018' },
    { t: 'Fokker 100, Southampton, 1998', d: 'A Fokker 100 serious incident at Southampton. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'F100,_Southampton_UK,_1998' },
    { t: 'PC-12 and A318, Toulouse, 2010', d: 'A runway conflict between a Pilatus PC-12 and an Airbus A318 at Toulouse. Read the SKYbrary summary.', u: SKY + 'PC12_/_A318,_Toulouse_France,_2010' },
    { t: 'MD-81, Stockholm, 1991', d: 'SAS 751 ingested clear ice shed from the wings into both engines after takeoff and crash-landed in a field. All 129 survived.', u: SKY + 'MD81,_Stockholm_Arlanda_Sweden,_1991' },
    { t: 'MD-11, New York JFK, 2003', d: 'An MD-11 serious incident at JFK. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'MD11,_New_York_JFK_USA,_2003' },
    { t: 'S-61, Bournemouth, 2002', d: 'A Sikorsky S-61 helicopter serious incident at Bournemouth. Read the SKYbrary summary.', u: SKY + 'S61,_Bournemouth_UK,_2002' },
    { t: 'MD-83 and ATR 72, Isfahan, 2018', d: 'A loss of separation between an MD-83 and an ATR 72 near Isfahan. Read the SKYbrary summary.', u: SKY + 'MD83_/_AT76,_Isfahan_Iran,_2018' },
    { t: 'UAV, Reims, 2006', d: 'Loss of control of an unmanned aircraft near Reims. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'UAV,_Reims_France,_2006' },
    { t: 'Westwind, John Wayne, 1993', d: 'A Westwind business jet rolled over on final behind a 757 in its wake turbulence. Five died.', u: SKY + 'WW24,_John_Wayne_Airport_Santa_Ana_CA_USA,_1993' },
    { t: 'Hughes 500 and Jodel, 2007', d: 'A mid-air collision between a Hughes 500 helicopter and a Jodel light aircraft north of London in good weather.', u: SKY + 'H500_/_D150,_North_of_London_UK,_2007' },
    { t: 'Shorts 360, Edinburgh, 2001', d: 'A Shorts 360 lost both engines to snow ingestion after takeoff and ditched in the Firth of Forth. Both pilots died.', u: SKY + 'SH36,_Edinburgh_UK,_2001' },
    { t: 'Metro, Aberdeen, 2002', d: 'A Fairchild Metro serious incident at Aberdeen. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'SW4,_Aberdeen_UK,_2002' },
    { t: 'MD-82, Detroit, 1987', d: 'Northwest 255 took off with flaps and slats retracted and the takeoff warning inoperative. 154 died; one child survived.', u: SKY + 'MD82,_Detroit_MI_USA,_1987' },
    { t: '737, Pensacola, 2016', d: 'A Southwest 737 suffered an uncontained fan blade failure at cruise and diverted to Pensacola with a damaged wing and fuselage.', u: SKY + 'B737,_Pensacola_FL_USA,_2016' },
    { t: 'F-15 and 757, Birmingham, 2000', d: 'A near miss between a military F-15 and a Boeing 757 south-east of Birmingham.', u: SKY + 'F15_/_B752,_South_East_of_Birmingham_UK,_2000' },
    { t: 'F-16 and C150, South Carolina, 2015', d: 'An F-16 on a practice approach collided with a Cessna 150 near Charleston. Both in the Cessna died.', u: SKY + 'F16_/_C150,_Berkeley_County_SC_USA,_2015' },
    { t: 'Dash 8, Ottawa, 2003', d: 'A Dash 8 serious incident at Ottawa. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'DH8A,_Ottawa_Canada,_2003' },
    { t: 'E190, Vermont, 2016', d: 'An Embraer 190 serious incident over Vermont. Read the SKYbrary summary of what happened and the lessons.', u: SKY + 'E190,_Vermont_USA,_2016' },
    { t: '747, Alaska, 1989', d: 'KLM 867 flew into the ash cloud from Mount Redoubt and lost all four engines. The crew relit them and landed at Anchorage.', u: SKY + 'B744,_Alaska_USA,_1989' }
  ];

  // ---------- Aircraft (civil and general) ----------
  var AIRCRAFT = [
    { t: 'Aermacchi MB-339', d: 'Italian two-seat jet trainer and light attack aircraft, flown by the Frecce Tricolori display team.', u: SKY + 'M339' },
    { t: 'Airbus A320neo', d: 'The re-engined A320 with geared turbofans or LEAP engines, the best-selling airliner family in the world.', u: SKY + 'A20N' },
    { t: 'Boeing C-17 Globemaster III', d: 'Four-engine strategic airlifter that can land a tank on a short dirt strip.', u: SKY + 'C17' },
    { t: 'Dash 8 Q400', d: 'Fast 78-seat turboprop regional airliner with active noise cancellation in the cabin.', u: SKY + 'DH8D' },
    { t: 'Boeing 737 MAX 9', d: 'The stretched MAX with LEAP-1B engines and the split-tip winglets.', u: SKY + 'B39M' },
    { t: 'Cessna 172 Skyhawk', d: 'The most-produced aircraft in history and the trainer most pilots learned in.', u: SKY + 'C172' },
    { t: 'Douglas DC-3', d: 'The 1935 airliner that made airlines profitable and flew on as the C-47 in the war. Many still work today.', u: SKY + 'DC3' },
    { t: 'ATR 72-600', d: 'Franco-Italian 70-seat turboprop, the workhorse of short regional routes.', u: SKY + 'AT76' },
    { t: 'Agusta A129 Mangusta', d: 'Italy’s attack helicopter, the first designed and built wholly in Western Europe.', u: SKY + 'A129' },
    { t: 'GAK-22 Dino', d: 'A Russian light twin-boom utility aircraft from the 1990s.', u: SKY + 'DINO' },
    { t: 'Learjet 35', d: 'The classic 1970s business jet with Garrett turbofans and tip tanks.', u: SKY + 'LJ35' },
    { t: 'Gulfstream G280', d: 'Super mid-size business jet built with Israel Aerospace Industries, 3,600 nm range.', u: SKY + 'G280' },
    { t: 'HAL Dhruv', d: 'India’s indigenous twin-engine utility helicopter, flown by all three Indian services.', u: SKY + 'ALH' },
    { t: 'Handley Page Jetstream', d: 'British 1960s pressurised twin turboprop that grew into the BAe Jetstream 31 and 41.', u: SKY + 'JS20' },
    { t: 'Jurca MJ-2 Tempête', d: 'French single-seat wooden homebuilt sport aircraft from the 1950s.', u: SKY + 'MJ2' },
    { t: 'Cessna 441 Conquest II', d: 'Cessna’s pressurised twin turboprop with Garrett TPE331 engines.', u: SKY + 'C441' },
    { t: 'Jodel D.150 Mascaret', d: 'Two-seat French wooden light aircraft with the Jodel cranked wing.', u: SKY + 'D150' },
    { t: 'Piper PA-47 PiperJet', d: 'Piper’s single-engine very light jet prototype with the engine in the tail. Cancelled in 2011.', u: SKY + 'PA47' },
    { t: 'Raytheon Premier I', d: 'Light business jet with a carbon-fibre fuselage and a wide cabin for its class.', u: SKY + 'PRM1' },
    { t: 'MBB Bo 105', d: 'German light twin helicopter with a rigid rotor that lets it loop and roll.', u: SKY + 'B105' },
    { t: 'Mitsubishi MU-2 (LR-1)', d: 'Fast Japanese twin turboprop with spoilers instead of ailerons and a demanding reputation.', u: SKY + 'MU2' },
    { t: 'Piper L-18C Super Cub', d: 'The military Super Cub: a liaison and observation aircraft that lands anywhere.', u: SKY + 'PA18' },
    { t: 'Vickers VC10', d: 'British long-range airliner with four rear-mounted engines, later an RAF tanker.', u: SKY + 'VC10' },
    { t: 'Piaggio PD.808', d: 'Italian 1960s light business jet, mostly flown by the Italian Air Force.', u: SKY + 'P808' },
    { t: 'Myasishchev M-101 Expedition', d: 'Russian single-engine pressurised turboprop with a PT6, built in small numbers.', u: SKY + 'M101' },
    { t: 'Melex Turbine Dromader', d: 'Turboprop version of the Polish PZL M-18 agricultural and firefighting aircraft.', u: SKY + 'M18T' },
    { t: 'Lake Buccaneer', d: 'Single-engine amphibian with the engine on a pylon above the hull.', u: SKY + 'LA4' },
    { t: 'Khrunichev T-411 Aist', d: 'Russian high-wing utility aircraft that looks and works like a Cessna 185.', u: SKY + 'T411' },
    { t: 'Robin R.1180 Aiglon', d: 'French four-seat metal light aircraft from the Robin family.', u: SKY + 'R100' },
    { t: 'Zenair Acro-Zenith CH 150', d: 'Single-seat aerobatic homebuilt from Zenair, designed for amateur builders.', u: SKY + 'CH15' },
    { t: 'Yakovlev Yak-42', d: 'Soviet three-engine short-haul airliner, a larger successor to the Yak-40.', u: SKY + 'YK42' },
    { t: 'Pilatus PC-24', d: 'Swiss business jet built to use short unpaved runways, the "Super Versatile Jet".', u: SKY + 'PC24' },
    { t: 'Aérospatiale Alouette II', d: 'The first production turbine helicopter, 1955. Set altitude records and flew rescue for decades.', u: SKY + 'ALO2' },
    { t: 'Airbus A400M Atlas', d: 'European four-turboprop airlifter with counter-rotating eight-blade propellers.', u: SKY + 'A400' },
    { t: 'Boeing 767-200ER', d: 'The extended-range 767 that opened transatlantic twin-engine ETOPS flying.', u: SKY + 'B762' },
    { t: 'Beechcraft 1900', d: '19-seat regional turboprop and air ambulance with its distinctive tail fins.', u: SKY + 'B190' },
    { t: 'Antonov An-124 Ruslan', d: 'One of the largest cargo aircraft ever built, with a nose that opens for outsize loads.', u: SKY + 'A124' },
    { t: 'Aeritalia G.222', d: 'Italian twin-turboprop tactical transport, flown by the USAF as the C-27A.', u: SKY + 'G222' }
  ];

  // ---------- Checklist procedure (a 172-class trainer) ----------
  var CHECKLIST = [
    { t: 'Preflight Inspection', d: 'Documents aboard (ARROW). Control lock out. Master on: fuel quantity, flaps down, lights. Master off. Walk-around: fuel sumps, oil, tires, control surfaces, pitot cover off, tie-downs off.', u: HANDBOOK },
    { t: 'Before Starting Engine', d: 'Preflight complete. Seats and belts adjusted and locked. Brakes test and set. Circuit breakers in. Avionics off. Fuel selector BOTH.', u: HANDBOOK },
    { t: 'Engine Start', d: 'Mixture rich. Carb heat cold. Prime as required. Throttle open 1/4 in. Propeller area CLEAR. Master on. Ignition START. Oil pressure within 30 seconds. Avionics on. Flaps up.', u: HANDBOOK },
    { t: 'Before Taxi', d: 'ATIS and altimeter set. Radios and transponder set. Flaps up. Taxi clearance received. Lights as required. Brakes checked as you roll.', u: HANDBOOK },
    { t: 'Taxi Check', d: 'Brakes work. Turn coordinator ball and needle move the right way. Heading indicator and compass turn together. Controls positioned for the wind.', u: HANDBOOK },
    { t: 'Before Takeoff (Run-up)', d: 'Brakes set. Controls free and correct. Trim takeoff. Fuel BOTH, mixture rich. 1,700 RPM: mags (125 drop max, 50 difference), carb heat, engine gauges, suction. Idle check. Instruments set. Flaps set. Doors and windows locked. Transponder ALT. Takeoff briefing.', u: HANDBOOK },
    { t: 'Normal Takeoff', d: 'Flaps 0–10°. Throttle full. Airspeed alive, engine gauges green. Rotate 55 kt. Climb 74 kt (Vy) or 62 kt (Vx) over obstacles. Flaps up above 200 ft.', u: HANDBOOK },
    { t: 'Climb', d: 'Airspeed 70–85 kt. Throttle full. Mixture rich below 3,000 ft, lean for smooth running above. Engine gauges green. Trim.', u: HANDBOOK },
    { t: 'Cruise', d: 'Power 2,200–2,700 RPM. Trim. Mixture leaned. Every 15 minutes: fuel, engine gauges, heading indicator aligned with compass, altimeter set, position.', u: HANDBOOK },
    { t: 'Descent', d: 'ATIS and altimeter set. Power as required (avoid shock cooling). Mixture enrich as you descend. Carb heat as needed. Fuel BOTH. Approach briefing.', u: HANDBOOK },
    { t: 'Before Landing (GUMPS)', d: 'Gas: fuel BOTH. Undercarriage: down and locked. Mixture: rich. Prop: carb heat ON (or prop high RPM). Seatbelts and Switches: landing light on. Flaps as required. Final 60–70 kt.', u: HANDBOOK },
    { t: 'Go-Around', d: 'Power FULL. Carb heat cold. Flaps to 20° immediately. Pitch for 55 kt, then 60 kt. Positive rate: flaps 10°, then up above 300 ft. Trim. Then talk.', u: HANDBOOK },
    { t: 'After Landing', d: 'Clear of the runway and stopped: flaps up, carb heat cold, transponder as required, landing light off, trim set for takeoff, mixture lean for taxi.', u: HANDBOOK },
    { t: 'Securing the Aircraft', d: 'Parking brake set. Avionics off. Electrical equipment off. Mixture idle cut-off. Ignition off, key out. Master off. Control lock in. Fuel selector per POH. Tie-downs and pitot cover.', u: HANDBOOK },
    { t: 'Engine Failure in Flight', d: 'Memory items: airspeed 68 kt best glide. Fuel BOTH. Mixture rich. Carb heat on. Mags BOTH, try START. Primer in and locked. No restart: field, 121.5 mayday, 7700, secure engine, doors unlatched.', u: HANDBOOK },
    { t: 'Engine Failure After Takeoff', d: 'Memory items: airspeed 65 kt flaps up (60 kt flaps down). Mixture idle cut-off. Fuel off. Ignition off. Flaps as required. Master off. Land straight ahead within 30° either side.', u: HANDBOOK },
    { t: 'Emergency Descent', d: 'Power idle. Carb heat on. Flaps per POH, gear down if retractable. Bank 30–45° to keep the nose down and the load on. Airspeed below Vne, or Vfe with flaps. Level off above the ground.', u: HANDBOOK },
    { t: 'Electrical Fire in Flight', d: 'Master off. All switches off (except mags). Vents and cabin heat closed. Fire extinguisher. Ventilate when out. If needed: master on, breakers checked, then switches on one at a time with a pause between.', u: HANDBOOK }
  ];

  // ---------- Regulation ----------
  function far(sec, title, desc) { return { t: '§' + sec + ' ' + title, d: desc, u: CFR14 + sec }; }
  var REG = [
    far('91.3', 'Pilot in command', 'The PIC is directly responsible for, and the final authority as to, the operation of the aircraft. In an in-flight emergency you may deviate from any rule to the extent required, and must report it on ATC’s request.'),
    far('91.7', 'Airworthiness', 'No one may fly an aircraft unless it is in an airworthy condition. The PIC decides whether it is, and must discontinue the flight when it stops being so.'),
    far('91.9', 'Flight manual and placards', 'Operate within the limits in the approved flight manual, markings and placards, and keep the AFM aboard.'),
    far('91.13', 'Careless or reckless', 'No one may operate an aircraft in a careless or reckless manner so as to endanger the life or property of another. The catch-all rule on almost every enforcement case.'),
    far('91.17', 'Alcohol and drugs', 'No flying within 8 hours of drinking, while under the influence, with 0.04 or more blood alcohol, or on any drug that affects safety. Eight hours bottle to throttle is the minimum, not the standard.'),
    far('91.103', 'Preflight action', 'Become familiar with all available information: for IFR or away from an airport, weather, fuel, alternates and known delays; for every flight, runway lengths and takeoff and landing distances. Remember NWKRAFT.'),
    far('91.105', 'Crew at stations', 'Required crew stay at their stations with seat belts fastened, and shoulder harnesses on for takeoff and landing if installed.'),
    far('91.107', 'Safety belts', 'The PIC briefs passengers on belts and makes sure everyone is strapped in for taxi, takeoff and landing. Children under two may be held.'),
    far('91.111', 'Operating near other aircraft', 'Do not operate so close to another aircraft as to create a collision hazard. Formation only by arrangement with each PIC, and never with paying passengers.'),
    far('91.113', 'Right-of-way rules', 'In distress has priority. Balloon, glider, airship, airplane and rotorcraft in that order; the aircraft being overtaken or that is refuelling has priority. Converging: the one on the right. Head-on: both turn right. Landing: the lower aircraft, but do not cut in front.'),
    far('91.117', 'Aircraft speed', '250 kt below 10,000 ft MSL. 200 kt at or below 2,500 ft AGL within 4 nm of a Class C or D primary airport, and 200 kt under a Class B shelf or in a VFR corridor through it.'),
    far('91.119', 'Minimum safe altitudes', 'Always high enough to land without undue hazard if the engine fails. Over congested areas 1,000 ft above the highest obstacle within 2,000 ft; elsewhere 500 ft AGL, and 500 ft from any person, vessel or structure over open water or sparse areas.'),
    far('91.121', 'Altimeter settings', 'Below 18,000 ft set the current reported setting of a station within 100 nm (or the departure field elevation). At and above FL180 set 29.92.'),
    far('91.123', 'ATC clearances', 'Once you accept a clearance you may not deviate from it except in an emergency or for a TCAS resolution advisory. Ask if in doubt, tell ATC as soon as possible after any deviation, and file a written report within 48 hours if asked.'),
    far('91.126', 'Class G near an airport', 'At an airport in Class G, airplanes turn left in the pattern unless signs or light signals say right, and helicopters avoid the fixed-wing flow.'),
    far('91.129', 'Class D', 'Establish two-way radio communication before entering and keep it up inside. Hearing your call sign counts; "stand by" does not. Follow traffic-pattern and departure instructions from the tower.'),
    far('91.130', 'Class C', 'Two-way communication before entry, plus a Mode C transponder and ADS-B Out. Approach control sequences you in; the tower lands you.'),
    far('91.131', 'Class B', 'An ATC clearance into Class B is required ("cleared into the Bravo"), along with a transponder and ADS-B Out. Private pilots or students with the endorsement; some Class B airports bar students entirely.'),
    far('91.135', 'Class A', 'Everything from 18,000 ft to FL600 is Class A: IFR only, with an ATC clearance, on a flight plan, with a transponder.'),
    far('91.137', 'Temporary flight restrictions', 'TFRs for disasters, VIP movements and events. Check NOTAMs before every flight; a TFR bust is one of the most common ways to lose a certificate.'),
    far('91.151', 'VFR fuel requirements', 'Enough fuel to reach the first point of intended landing plus 30 minutes by day or 45 minutes at night at normal cruise. Plan for an hour.'),
    far('91.155', 'Basic VFR weather minimums', 'Class B: 3 sm, clear of clouds. C, D and E below 10,000: 3 sm, 500 below, 1,000 above, 2,000 horizontal. G by day below 1,200 AGL: 1 sm, clear of clouds. Above 10,000 in E or G: 5 sm, 1,000/1,000/1 sm.'),
    far('91.157', 'Special VFR', 'In a surface area with an ATC clearance: 1 sm and clear of clouds. At night it also needs an instrument rating and an IFR-equipped aircraft.'),
    far('91.159', 'VFR cruising altitudes', 'More than 3,000 ft AGL: magnetic course 0–179 fly odd thousands plus 500; 180–359 fly even thousands plus 500.'),
    far('91.167', 'IFR fuel requirements', 'Fuel to the destination, then to the alternate, then 45 minutes at normal cruise. No alternate is needed if the 1-2-3 rule is met at the destination.'),
    far('91.169', 'IFR alternate', 'File an alternate unless, from one hour before to one hour after the ETA, the ceiling is at least 2,000 ft and visibility 3 sm. Standard alternate minimums: 600-2 with a precision approach, 800-2 without.'),
    far('91.171', 'VOR check', 'For IFR the VOR must have been checked within 30 days: within 4° on a ground checkpoint or VOT, 6° airborne, or 4° between two receivers. Log date, place, error and signature.'),
    far('91.173', 'IFR clearance and flight plan', 'No IFR flight in controlled airspace without a filed flight plan and an ATC clearance.'),
    far('91.175', 'Landing under IFR', 'Descend below DA or MDA only when you are in a position to land normally, the flight visibility meets the minimums, and you have the runway environment in sight (approach lights alone get you to 100 ft above touchdown).'),
    far('91.177', 'IFR minimum altitudes', 'Off published routes: 2,000 ft above the highest obstacle within 4 nm in mountainous areas, 1,000 ft elsewhere.'),
    far('91.185', 'Two-way radio failure (IFR)', 'In VFR conditions, continue VFR and land as soon as practicable. In IMC fly the route assigned, vectored, expected or filed (AVEF) at the highest of the assigned, minimum or expected altitude (MEA), and leave the clearance limit at the EFC or ETA.'),
    far('91.205', 'Required instruments', 'Day VFR: ATOMATOFLAMES (airspeed, tach, oil pressure, manifold pressure, altimeter, temperature, oil temp, fuel gauges, landing gear lights, anticollision lights, magnetic compass, ELT, seat belts). Night adds FLAPS: fuses, landing light (for hire), anticollision, position lights, source of power. IFR adds GRABCARD.'),
    far('91.207', 'Emergency locator transmitter', 'An ELT is required for most flights. Inspect it every 12 months; replace the battery after one hour of cumulative use or at half its useful life. Training flights within 50 nm of base are exempt.'),
    far('91.209', 'Aircraft lights', 'Position lights on from sunset to sunrise; an anticollision light system on whenever the aircraft is operating unless the PIC judges it safer off.'),
    far('91.211', 'Supplemental oxygen', 'Crew must use oxygen above 12,500 ft cabin altitude for more than 30 minutes, at all times above 14,000, and passengers must be offered it above 15,000.'),
    far('91.213', 'Inoperative equipment', 'You may fly with something broken only under an MEL, or if it is not required by 91.205, the type certificate, an AD or the aircraft’s equipment list, and it is removed or deactivated and placarded INOPERATIVE.'),
    far('91.215', 'Transponder', 'A Mode C transponder is required in Class A, B and C, within the 30 nm Mode C veil of a Class B airport, above 10,000 ft MSL (except below 2,500 AGL) and above Class B or C airspace.'),
    far('91.225', 'ADS-B Out', 'ADS-B Out is required in the same airspace as a transponder: Class A, B and C, the Mode C veil, above 10,000 ft MSL, and over the Gulf of Mexico above 3,000 ft within 12 nm of the coast.'),
    far('91.409', 'Inspections', 'An annual inspection every 12 calendar months. Aircraft used for hire or for flight instruction also need a 100-hour inspection, which may be overflown by 10 hours only to reach the shop.'),
    far('91.417', 'Maintenance records', 'The owner keeps records of all maintenance, the current status of ADs, inspections and life-limited parts. AV1ATE: Annual, VOR, 100-hour, Altimeter and pitot-static (24 months), Transponder (24 months), ELT.'),
    far('61.3', 'Certificates in your possession', 'Carry your pilot certificate, a government photo ID and your medical (or BasicMed paperwork) on every flight as a required crewmember.'),
    far('61.23', 'Medical certificates', 'First class lasts 12 months (6 for ATP privileges over 40), second class 12 months, third class 60 months under 40 and 24 months over. BasicMed is an alternative for most private flying.'),
    far('61.31', 'Endorsements', 'Additional training and a logbook endorsement are needed before acting as PIC of a complex, high-performance, pressurised or tailwheel airplane.'),
    far('61.51', 'Logbooks', 'What you must log, and when you may log PIC time: a private pilot may log PIC when the sole manipulator of the controls of an aircraft they are rated in.'),
    far('61.56', 'Flight review', 'Every 24 calendar months: at least one hour of ground and one hour of flight with an instructor. A new certificate or rating resets the clock.'),
    far('61.57', 'Recent flight experience', 'Three takeoffs and landings in the past 90 days in category, class and type to carry passengers; at night they must be to a full stop. IFR currency: six approaches, holding and tracking within six months.'),
    far('61.89', 'Student pilot limitations', 'No passengers, no flights for hire, no flying with less than 3 sm visibility by day or 5 sm at night, and never without visual reference to the surface.'),
    far('61.113', 'Private pilot privileges', 'No flying for compensation or hire. You may share expenses pro rata with passengers (fuel, oil, airport fees, rental) as long as you pay your share.'),
    { t: 'NTSB 830.5 Immediate notification', d: 'Notify the nearest NTSB office immediately after an accident or any listed serious incident: flight control failure, crew incapacitation, in-flight fire, mid-air collision, damage over $25,000 to property, and more.', u: 'https://www.ecfr.gov/current/title-49/section-830.5' }
  ];

  // ---------- Phraseology (Pilot/Controller Glossary) ----------
  function pcg(t, d) { return { t: t, d: d, u: PCG + t.charAt(0).toLowerCase() + '.html' }; }
  var PHRASE = [
    pcg('ABEAM', 'An aircraft is abeam a fix, point or object when that point is approximately 90 degrees to the right or left of the aircraft track. It indicates a general position rather than a precise point.'),
    pcg('ABORT', 'To terminate a preplanned aircraft maneuver; for example, an aborted takeoff.'),
    pcg('ACKNOWLEDGE', 'Let me know that you have received my message.'),
    pcg('ADVISE INTENTIONS', 'Tell me what you plan to do.'),
    pcg('AFFIRMATIVE', 'Yes.'),
    pcg('ALTIMETER SETTING', 'The barometric pressure reading used to adjust a pressure altimeter for variations in existing atmospheric pressure, or to the standard altimeter setting of 29.92.'),
    pcg('BLOCKED', 'Phraseology used to indicate that a radio transmission has been distorted or interrupted due to multiple simultaneous radio transmissions.'),
    pcg('BRAKING ACTION', 'A report of conditions on the airport movement area giving a pilot the degree and quality of braking to expect: good, good to medium, medium, medium to poor, poor, or nil.'),
    pcg('CLEARANCE LIMIT', 'The fix, point or location to which an aircraft is cleared when issued an air traffic clearance.'),
    pcg('CLEARANCE VOID IF NOT OFF BY (TIME)', 'Used by ATC to advise an aircraft that the departure clearance is automatically cancelled if takeoff is not made before the specified time. The pilot must then obtain a new clearance or cancel the IFR flight plan.'),
    pcg('CLEARED APPROACH', 'ATC authorization for an aircraft to execute any standard or special instrument approach procedure for that airport. Normally an aircraft is cleared for a specific procedure.'),
    pcg('CLEARED AS FILED', 'The aircraft is cleared to proceed in accordance with the route of flight filed in the flight plan. This clearance does not include the altitude, DP or DP transition.'),
    pcg('CLEARED FOR TAKEOFF', 'ATC authorization for an aircraft to depart. It is predicated on known traffic and known physical airport conditions.'),
    pcg('CLEARED FOR THE OPTION', 'ATC authorization for an aircraft to make a touch-and-go, low approach, missed approach, stop-and-go or full-stop landing at the discretion of the pilot.'),
    pcg('CLEARED TO LAND', 'ATC authorization for an aircraft to land. It is predicated on known traffic and known physical airport conditions.'),
    pcg('CLOSED TRAFFIC', 'Successive operations involving takeoffs and landings or low approaches where the aircraft does not exit the traffic pattern.'),
    pcg('CONTACT', 'Establish communication with (followed by the name of the facility and, if appropriate, the frequency to be used).'),
    pcg('CORRECTION', 'An error has been made in the transmission and the correct version follows.'),
    pcg('CRUISE', 'Used in an ATC clearance to authorize flight at any altitude from the minimum IFR altitude up to and including the altitude specified. Once you report leaving an altitude you may not return to it. It also authorizes an approach at the destination.'),
    pcg('DIRECT', 'Straight-line flight between two navigational aids, fixes, points or any combination of them. On off-airway routes the points defining the segments become compulsory reporting points unless under radar contact.'),
    pcg('EMERGENCY', 'A distress or an urgency condition.'),
    pcg('EXPECT (ALTITUDE) AT (TIME) OR (FIX)', 'Gives a pilot an altitude to use in the event of two-way communications failure, and altitude information to help with planning.'),
    pcg('EXPEDITE', 'Used by ATC when prompt compliance is required to avoid the development of an imminent situation. Expedite climb or descent means approximately the best rate, without an exceptional change in aircraft handling.'),
    pcg('FINAL', 'Commonly used to mean that an aircraft is on the final approach course or is aligned with a landing area.'),
    pcg('FLY HEADING (DEGREES)', 'Informs the pilot of the heading to fly. The pilot may have to turn to, or continue on, a specific compass direction, and is expected to turn the shorter way unless otherwise instructed.'),
    pcg('FUEL REMAINING', 'When relating fuel remaining to ATC, pilots state the approximate number of minutes the flight can continue with the fuel on board, including reserves.'),
    pcg('GO AROUND', 'Instructions for a pilot to abandon the approach to landing. Unless otherwise advised, a VFR aircraft should overfly the runway while climbing to pattern altitude and enter the pattern via the crosswind leg.'),
    pcg('HAVE NUMBERS', 'Used by pilots to inform ATC that they have received runway, wind and altimeter information only.'),
    pcg('HOLD FOR RELEASE', 'Used by ATC to delay an aircraft for traffic management reasons. An IFR departure clearance is not valid until a release time or further instructions have been received.'),
    pcg('HOW DO YOU HEAR ME?', 'A question relating to the quality of the transmission, or to determine how well the transmission is being received.'),
    pcg('IDENT', 'A request for a pilot to activate the aircraft transponder identification feature. This helps the controller confirm an aircraft’s identity.'),
    pcg('IMMEDIATELY', 'Used by ATC or pilots when such action compliance is required to avoid an imminent situation.'),
    pcg('I SAY AGAIN', 'The message will be repeated.'),
    pcg('LAHSO', 'Land and Hold Short Operations: simultaneous takeoffs and landings, or landings, where a landing aircraft is able and is instructed to hold short of an intersecting runway, taxiway or designated hold-short point.'),
    pcg('LIGHT GUN', 'A handheld directional light signalling device that emits a narrow beam of white, green or red light as selected by the tower controller, used when radio communication is not available.'),
    pcg('LINE UP AND WAIT', 'Used by ATC to inform a pilot to taxi onto the departure runway, line up and wait. It is not authorization for takeoff.'),
    pcg('LOW APPROACH', 'An approach over an airport or runway following an instrument or VFR approach, including the go-around, where the pilot intentionally does not make contact with the runway.'),
    pcg('MAINTAIN', 'For an altitude, remain at the altitude specified, usually preceded by "climb and" or "descend and". For other instructions it is used in its literal sense, for example "maintain VFR".'),
    pcg('MAKE SHORT APPROACH', 'Used by ATC to inform a pilot to alter the traffic pattern so as to make a short final approach.'),
    pcg('MAYDAY', 'The international radiotelephony distress signal. Repeated three times it indicates imminent and grave danger and that immediate assistance is requested.'),
    pcg('MINIMUM FUEL', 'The fuel supply has reached a state where, on reaching the destination, the aircraft can accept little or no delay. It is not an emergency, but one is possible should any undue delay occur.'),
    pcg('MONITOR', 'When used with a communication transfer: listen on a specific frequency and stand by for instructions. Under normal circumstances do not establish communications.'),
    pcg('NEGATIVE', '"No", or "permission not granted", or "that is not correct".'),
    pcg('NEGATIVE CONTACT', 'Used by pilots to inform ATC that previously issued traffic is not in sight, or that they were unable to contact ATC on a particular frequency.'),
    pcg('NO GYRO APPROACH', 'A radar approach or vector for an aircraft with a failed gyro compass. Instead of headings, the controller says "turn right", "turn left" or "stop turn" while watching the radar track.'),
    pcg('OUT', 'The conversation is ended and no response is expected.'),
    pcg('OVER', 'My transmission is ended; I expect a response.'),
    pcg('PAN-PAN', 'The international radiotelephony urgency signal. Repeated three times it indicates uncertainty or alert, followed by the nature of the urgency.'),
    pcg('PILOT’S DISCRETION', 'With an altitude assignment, ATC has offered the option of starting the climb or descent whenever you wish, at any rate, with intermediate level-offs. Once you have vacated an altitude you may not return to it.'),
    pcg('RADAR CONTACT', 'Used by ATC to inform an aircraft that it is identified on the radar display and radar flight following will be provided until radar identification is terminated. The pilot then stops reporting over compulsory reporting points.'),
    pcg('RADAR SERVICE TERMINATED', 'Used by ATC to inform a pilot that none of the services available while in radar contact will be provided any longer.'),
    pcg('READ BACK', 'Repeat my message back to me.'),
    pcg('RELEASE TIME', 'A departure time restriction issued to a pilot by ATC when necessary to separate a departing aircraft from other traffic.'),
    pcg('REPORT', 'Used to instruct pilots to advise ATC of specified information; for example, "report passing Hamilton VOR".'),
    pcg('RESUME NORMAL SPEED', 'Used by ATC to advise a pilot that previously issued speed control restrictions are deleted. It does not delete speed restrictions on published procedures unless ATC says so.'),
    pcg('RESUME OWN NAVIGATION', 'Used by ATC to advise a pilot to resume their own navigational responsibility. Issued after a radar vector, or when radar contact is lost during vectoring.'),
    pcg('ROGER', 'I have received all of your last transmission. It should not be used to answer a question requiring a yes or a no.'),
    pcg('RUNWAY HEADING', 'The magnetic direction of the runway centerline extended, not the painted number. Cleared to fly runway heading, fly that heading with no drift correction: for runway 4 with a centerline of 044, fly 044.'),
    pcg('SAY AGAIN', 'Used to request a repeat of the last transmission, usually specifying the part not understood; for example, "say again all after ABRAM VOR".'),
    pcg('SAY ALTITUDE', 'Used by ATC to ascertain an aircraft’s specific altitude. When climbing or descending, state the indicated altitude rounded to the nearest 100 feet.'),
    pcg('SAY HEADING', 'Used by ATC to request an aircraft heading. The pilot states the actual heading of the aircraft.'),
    pcg('SIDESTEP MANEUVER', 'A visual maneuver at the completion of an instrument approach to land straight in on a parallel runway not more than 1,200 feet to either side of the approach runway.'),
    pcg('SPEAK SLOWER', 'Used in verbal communications as a request to reduce speech rate.'),
    pcg('SPECIAL VFR OPERATIONS', 'Aircraft operating with clearances within Class B, C, D and E surface areas in weather below basic VFR minima. Such operations must be requested by the pilot and approved by ATC.'),
    pcg('SQUAWK', 'Activate specific modes, codes or functions on the aircraft transponder; for example, "squawk two one zero five".'),
    pcg('STAND BY', 'The controller or pilot must pause for a few seconds, usually to attend to higher-priority duties. Also means to wait, as in "stand by for clearance". It is not an approval or a denial.'),
    pcg('STOP AND GO', 'A procedure wherein an aircraft lands, makes a complete stop on the runway, and then begins a takeoff from that point.'),
    pcg('TAXI', 'The movement of an airplane under its own power on the surface of an airport, including helicopters with wheels.'),
    pcg('THAT IS CORRECT', 'The understanding you have is right.'),
    pcg('TOUCH-AND-GO', 'An operation by an aircraft that lands and departs on a runway without stopping or exiting the runway.'),
    pcg('TRAFFIC ADVISORIES', 'Advisories issued to alert pilots to other known or observed air traffic close enough to their position or route to warrant attention, commonly called flight following.'),
    pcg('TRAFFIC IN SIGHT', 'Used by pilots to inform a controller that previously issued traffic is in sight.'),
    pcg('TRAFFIC NO FACTOR', 'Indicates that the traffic described in a previously issued traffic advisory is no factor.'),
    pcg('TRAFFIC NO LONGER OBSERVED', 'Indicates that the traffic described in a previously issued advisory is no longer depicted on radar, but may still be a factor.'),
    pcg('UNABLE', 'Indicates inability to comply with a specific instruction, request or clearance.'),
    pcg('VECTOR', 'A heading issued to an aircraft to provide navigational guidance by radar.'),
    pcg('VERIFY', 'Request confirmation of information; for example, "verify assigned altitude".'),
    pcg('VFR-ON-TOP', 'ATC authorization for an IFR aircraft to operate in VFR conditions at any appropriate VFR altitude.'),
    pcg('WAKE TURBULENCE', 'Phenomena resulting from the passage of an aircraft through the atmosphere: wingtip vortices, jet blast, prop wash and rotor wash, on the ground and in the air.'),
    pcg('WHEN ABLE', 'Gives the pilot the latitude to delay compliance until a condition or event has been reconciled. Unlike pilot’s discretion, the pilot is expected to seek the first opportunity to comply.'),
    pcg('WILCO', 'I have received your message, understand it, and will comply with it.'),
    pcg('WORDS TWICE', 'As a request: communication is difficult, please say every phrase twice. As information: since communication is difficult, every phrase in this message will be spoken twice.')
  ];

  // ---------- Military aircraft (in service today) ----------
  function w(t, d, page) { return { t: t, d: d, u: WIKI + page }; }
  var MIL = [
    w('F-22 Raptor', 'US stealth air-superiority fighter with thrust vectoring and supercruise. Only 187 built.', 'Lockheed_Martin_F-22_Raptor'),
    w('F-35 Lightning II', 'Stealth multirole fighter in three versions: conventional, short takeoff and vertical landing, and carrier. Flown by more than a dozen nations.', 'Lockheed_Martin_F-35_Lightning_II'),
    w('F-15EX Eagle II', 'The newest Eagle: fly-by-wire, a huge weapons load and a 1980s airframe that still has no air-to-air losses.', 'Boeing_F-15EX_Eagle_II'),
    w('F-16 Fighting Falcon', 'The light multirole fighter of 25 air forces, now flying with AESA radar and in the Block 70.', 'General_Dynamics_F-16_Fighting_Falcon'),
    w('F/A-18E/F Super Hornet', 'The US Navy’s carrier strike fighter, bigger and longer-ranged than the Hornet it replaced.', 'Boeing_F/A-18E/F_Super_Hornet'),
    w('EA-18G Growler', 'Electronic attack Super Hornet that jams radars and radios for the strike package.', 'Boeing_EA-18G_Growler'),
    w('A-10 Thunderbolt II', 'Built around a 30 mm cannon for close air support, with a titanium bathtub around the pilot.', 'Fairchild_Republic_A-10_Thunderbolt_II'),
    w('B-2 Spirit', 'Flying-wing stealth bomber. 21 were built; it flies 30-hour missions from Missouri.', 'Northrop_Grumman_B-2_Spirit'),
    w('B-1B Lancer', 'Swing-wing supersonic bomber that carries the largest conventional payload in the US inventory.', 'Rockwell_B-1_Lancer'),
    w('B-52H Stratofortress', 'First flown in 1952 and planned to fly into the 2050s with new engines.', 'Boeing_B-52_Stratofortress'),
    w('B-21 Raider', 'The next US stealth bomber, first flown in 2023, designed to replace the B-1 and B-2.', 'Northrop_Grumman_B-21_Raider'),
    w('C-130J Super Hercules', 'The current Hercules with six-blade props and a glass cockpit, flying since the 1950s design was new.', 'Lockheed_Martin_C-130J_Super_Hercules'),
    w('KC-46 Pegasus', 'Boeing 767-based tanker with a remote-vision boom operator station.', 'Boeing_KC-46_Pegasus'),
    w('KC-135 Stratotanker', 'The 707-era tanker that has refuelled every US combat aircraft since 1957.', 'Boeing_KC-135_Stratotanker'),
    w('E-3 Sentry', 'AWACS: a 707 with a rotating radar dome that watches and controls the air battle.', 'Boeing_E-3_Sentry'),
    w('E-2D Advanced Hawkeye', 'Carrier-borne airborne early warning aircraft with a 24-ft rotodome and eight-blade props.', 'Northrop_Grumman_E-2_Hawkeye'),
    w('P-8A Poseidon', 'Maritime patrol and anti-submarine 737 with sonobuoys, torpedoes and Harpoon missiles.', 'Boeing_P-8_Poseidon'),
    w('V-22 Osprey', 'Tiltrotor that takes off like a helicopter and cruises like a turboprop.', 'Bell_Boeing_V-22_Osprey'),
    w('AH-64E Apache', 'The US Army attack helicopter with Longbow radar and Hellfire missiles.', 'Boeing_AH-64_Apache'),
    w('UH-60M Black Hawk', 'The utility helicopter of the US Army and 30 other countries.', 'Sikorsky_UH-60_Black_Hawk'),
    w('CH-47F Chinook', 'Tandem-rotor heavy lifter in service since Vietnam, still carrying artillery and troops.', 'Boeing_CH-47_Chinook'),
    w('CH-53K King Stallion', 'The US Marines’ new heavy-lift helicopter, lifting 36,000 lb externally.', 'Sikorsky_CH-53K_King_Stallion'),
    w('AH-1Z Viper', 'The Marines’ twin-engine attack Cobra with a four-blade composite rotor.', 'Bell_AH-1Z_Viper'),
    w('MQ-9 Reaper', 'Remotely piloted hunter-killer with a 27-hour endurance and Hellfires under the wings.', 'General_Atomics_MQ-9_Reaper'),
    w('RQ-4 Global Hawk', 'High-altitude surveillance drone that flies above 60,000 ft for more than 30 hours.', 'Northrop_Grumman_RQ-4_Global_Hawk'),
    w('U-2 Dragon Lady', 'The 1955 spy plane still flying reconnaissance at 70,000 ft, landed with a chase car.', 'Lockheed_U-2'),
    w('T-7A Red Hawk', 'The USAF’s new jet trainer from Boeing and Saab, replacing the T-38.', 'Boeing%E2%80%93Saab_T-7_Red_Hawk'),
    w('T-38 Talon', 'The supersonic trainer every USAF fighter and bomber pilot has flown since 1961.', 'Northrop_T-38_Talon'),
    w('T-6 Texan II', 'Turboprop primary trainer for the USAF and US Navy, based on the Pilatus PC-9.', 'Beechcraft_T-6_Texan_II'),
    w('T-45 Goshawk', 'Carrier-capable version of the BAE Hawk that trains US Navy pilots.', 'McDonnell_Douglas_T-45_Goshawk'),
    w('Eurofighter Typhoon', 'Canard-delta twin-engine fighter of the UK, Germany, Italy, Spain and others.', 'Eurofighter_Typhoon'),
    w('Dassault Rafale', 'France’s omnirole fighter, flown from land and from the carrier Charles de Gaulle.', 'Dassault_Rafale'),
    w('Saab JAS 39 Gripen', 'Light Swedish fighter designed to operate from highways and be turned round by conscripts.', 'Saab_JAS_39_Gripen'),
    w('Panavia Tornado', 'Swing-wing strike aircraft of Germany and Italy, famous for low-level penetration.', 'Panavia_Tornado'),
    w('Sukhoi Su-35', 'Russia’s most advanced Flanker, with thrust vectoring and a long-range radar.', 'Sukhoi_Su-35'),
    w('Sukhoi Su-34', 'Side-by-side two-seat strike Flanker with an armoured cockpit and a galley.', 'Sukhoi_Su-34'),
    w('Sukhoi Su-57', 'Russia’s fifth-generation stealth fighter, in service in small numbers.', 'Sukhoi_Su-57'),
    w('Sukhoi Su-30', 'Two-seat multirole Flanker flown by India, China, Russia and many others.', 'Sukhoi_Su-30'),
    w('MiG-29 Fulcrum', 'Agile Soviet front-line fighter of the 1980s, still widely flown and upgraded.', 'Mikoyan_MiG-29'),
    w('MiG-31 Foxhound', 'Mach 2.8 interceptor with the first fighter phased-array radar, now carrying the Kinzhal missile.', 'Mikoyan_MiG-31'),
    w('Tu-160 Blackjack', 'The largest and heaviest combat aircraft ever: a supersonic swing-wing bomber.', 'Tupolev_Tu-160'),
    w('Tu-95 Bear', 'Turboprop strategic bomber with contra-rotating props, flying since 1952 and still very loud.', 'Tupolev_Tu-95'),
    w('Il-76 Candid', 'Soviet four-jet heavy airlifter, still the backbone of Russian and many other transport fleets.', 'Ilyushin_Il-76'),
    w('Airbus A400M Atlas', 'European tactical and strategic airlifter with counter-rotating eight-blade props.', 'Airbus_A400M_Atlas'),
    w('Airbus A330 MRTT', 'Multirole tanker transport based on the A330, chosen by the RAF, Australia, France and NATO.', 'Airbus_A330_MRTT'),
    w('Chengdu J-20', 'China’s stealth fighter with canards and a long weapons bay, in service since 2017.', 'Chengdu_J-20'),
    w('Shenyang J-16', 'China’s two-seat multirole Flanker derivative with Chinese radar and weapons.', 'Shenyang_J-16'),
    w('Shenyang J-15', 'Carrier-borne Flanker flown from China’s ski-jump carriers.', 'Shenyang_J-15'),
    w('Chengdu J-10', 'Chinese single-engine canard-delta fighter, exported to Pakistan.', 'Chengdu_J-10'),
    w('Xian H-6', 'Chinese bomber descended from the Tu-16, now carrying cruise missiles and refuelling in flight.', 'Xian_H-6'),
    w('Xian Y-20', 'China’s heavy strategic airlifter, in the class of the C-17.', 'Xian_Y-20'),
    w('HAL Tejas', 'India’s indigenous light combat aircraft, a small tailless delta.', 'HAL_Tejas'),
    w('KAI T-50 Golden Eagle', 'South Korean supersonic trainer and light fighter (FA-50) built with Lockheed Martin.', 'KAI_T-50_Golden_Eagle'),
    w('KAI KF-21 Boramae', 'South Korea’s new twin-engine fighter, first flown in 2022.', 'KAI_KF-21_Boramae'),
    w('Mitsubishi F-2', 'Japan’s enlarged F-16 derivative with a composite wing and the first fighter AESA radar.', 'Mitsubishi_F-2'),
    w('Kawasaki C-2', 'Japanese twin-jet airlifter with a wide cabin and 4,000 nm range.', 'Kawasaki_C-2'),
    w('Kawasaki P-1', 'Japan’s four-engine maritime patrol jet with fly-by-light controls.', 'Kawasaki_P-1'),
    w('Embraer C-390 Millennium', 'Brazilian twin-jet tactical airlifter and tanker, chosen by Portugal, Hungary and the Netherlands.', 'Embraer_C-390_Millennium'),
    w('Embraer A-29 Super Tucano', 'Turboprop light attack and trainer with a machine gun in each wing.', 'Embraer_EMB_314_Super_Tucano'),
    w('Leonardo M-346 Master', 'Italian advanced jet trainer with fly-by-wire, flown by Italy, Israel, Singapore and Poland.', 'Alenia_Aermacchi_M-346_Master'),
    w('Pilatus PC-21', 'Swiss turboprop trainer that flies like a jet, used by Switzerland, Australia, France and others.', 'Pilatus_PC-21'),
    w('Dassault Mirage 2000', 'French delta fighter of the 1980s, still flown by France, India, Greece and the UAE.', 'Dassault_Mirage_2000'),
    w('Bayraktar TB2', 'Turkish medium-altitude armed drone that made headlines in Libya, Nagorno-Karabakh and Ukraine.', 'Bayraktar_TB2'),
    w('Eurocopter Tiger', 'Franco-German attack helicopter with a composite airframe and a mast-mounted sight.', 'Eurocopter_Tiger'),
    w('NH90', 'European medium twin helicopter with fly-by-wire, in army and naval versions.', 'NHIndustries_NH90'),
    w('AW101 Merlin', 'Three-engine medium-lift helicopter of the Royal Navy, RAF, Italy, Canada and others.', 'AgustaWestland_AW101'),
    w('Kamov Ka-52 Alligator', 'Russian coaxial-rotor attack helicopter with ejection seats.', 'Kamov_Ka-52'),
    w('Mil Mi-28 Havoc', 'Russian two-seat attack helicopter, the counterpart of the Apache.', 'Mil_Mi-28'),
    w('Mil Mi-24 Hind', 'The flying tank: a heavily armed gunship that also carries eight troops.', 'Mil_Mi-24'),
    w('Mil Mi-17', 'The world’s most widely used military transport helicopter, in service in 60 countries.', 'Mil_Mi-17')
  ];

  // ---------- Historical aircraft ----------
  var HIST = [
    w('Wright Flyer', '17 December 1903: the first controlled, powered, sustained flight of a heavier-than-air machine. 12 seconds, 120 feet.', 'Wright_Flyer'),
    w('Blériot XI', 'Louis Blériot crossed the English Channel in it in 1909, the first flight between countries.', 'Bl%C3%A9riot_XI'),
    w('Curtiss JN-4 Jenny', 'The US trainer of the First World War, then the barnstormers’ aircraft of the 1920s.', 'Curtiss_JN_Jenny'),
    w('Sopwith Camel', 'The British fighter credited with more aerial victories than any other in the First World War. Its rotary engine made it a handful.', 'Sopwith_Camel'),
    w('Fokker Dr.I', 'The triplane of the Red Baron, Manfred von Richthofen.', 'Fokker_Dr.I'),
    w('SPAD S.XIII', 'French fighter flown by Eddie Rickenbacker and most American aces of 1918.', 'SPAD_S.XIII'),
    w('Ryan NYP Spirit of St. Louis', 'Charles Lindbergh’s custom monoplane for the first solo non-stop Atlantic crossing, New York to Paris, May 1927.', 'Spirit_of_St._Louis'),
    w('Ford Trimotor', 'The Tin Goose: America’s first successful airliner, all metal and corrugated.', 'Ford_Trimotor'),
    w('Lockheed Vega', 'Streamlined wooden monoplane flown by Amelia Earhart and Wiley Post on their record flights.', 'Lockheed_Vega'),
    w('Boeing 247', 'The first modern airliner, 1933: all-metal, retractable gear, autopilot and de-icing boots.', 'Boeing_247'),
    w('Douglas DC-3', 'The 1935 airliner that made airlines profitable and won the war as the C-47.', 'Douglas_DC-3'),
    w('Lockheed Model 10 Electra', 'The twin-tailed airliner Amelia Earhart disappeared in over the Pacific in 1937.', 'Lockheed_Model_10_Electra'),
    w('Beechcraft Staggerwing', 'The elegant 1930s negative-stagger biplane, the executive aircraft of its day.', 'Beechcraft_Model_17_Staggerwing'),
    w('Piper J-3 Cub', 'The yellow trainer that taught a generation of Americans to fly before the war.', 'Piper_J-3_Cub'),
    w('Boeing-Stearman Model 75', 'The primary trainer of most US military pilots in the Second World War, then a crop duster.', 'Boeing-Stearman_Model_75'),
    w('North American T-6 Texan', 'The advanced trainer of the Allies: 15,000 built, and many still fly.', 'North_American_T-6_Texan'),
    w('Supermarine Spitfire', 'The elliptical-winged British fighter of the Battle of Britain and the whole war.', 'Supermarine_Spitfire'),
    w('Hawker Hurricane', 'Shot down more enemy aircraft in the Battle of Britain than all other defences combined.', 'Hawker_Hurricane'),
    w('Messerschmitt Bf 109', 'The Luftwaffe’s main fighter and the most-produced fighter in history, with nearly 34,000 built.', 'Messerschmitt_Bf_109'),
    w('Focke-Wulf Fw 190', 'The radial-engined German fighter that outclassed the Spitfire V when it appeared in 1941.', 'Focke-Wulf_Fw_190'),
    w('Mitsubishi A6M Zero', 'The long-ranged Japanese carrier fighter that dominated the Pacific in 1941 and 1942.', 'Mitsubishi_A6M_Zero'),
    w('Junkers Ju 87 Stuka', 'The dive bomber with the siren, the symbol of Blitzkrieg.', 'Junkers_Ju_87'),
    w('Ilyushin Il-2 Shturmovik', 'The armoured Soviet ground-attack aircraft, the most-produced military aircraft in history.', 'Ilyushin_Il-2'),
    w('North American P-51 Mustang', 'With the Merlin engine it escorted bombers all the way to Berlin and back.', 'North_American_P-51_Mustang'),
    w('Republic P-47 Thunderbolt', 'The Jug: the heaviest single-engine fighter of the war and a superb ground attacker.', 'Republic_P-47_Thunderbolt'),
    w('Lockheed P-38 Lightning', 'Twin-boom fighter that shot down Admiral Yamamoto and made the top US aces of the Pacific.', 'Lockheed_P-38_Lightning'),
    w('Vought F4U Corsair', 'The bent-wing bird: the US Navy and Marine fighter of the Pacific and Korea.', 'Vought_F4U_Corsair'),
    w('Grumman F6F Hellcat', 'Built to beat the Zero; it claimed 75% of US Navy aerial victories in the Pacific.', 'Grumman_F6F_Hellcat'),
    w('Boeing B-17 Flying Fortress', 'The daylight heavy bomber of the Eighth Air Force over Europe.', 'Boeing_B-17_Flying_Fortress'),
    w('Consolidated B-24 Liberator', 'The most-produced American military aircraft, with 18,000 built.', 'Consolidated_B-24_Liberator'),
    w('Boeing B-29 Superfortress', 'Pressurised, remote-controlled guns, and the aircraft that dropped the atomic bombs.', 'Boeing_B-29_Superfortress'),
    w('Avro Lancaster', 'The RAF’s night heavy bomber, flown on the Dambusters raid.', 'Avro_Lancaster'),
    w('de Havilland Mosquito', 'The Wooden Wonder: an unarmed bomber faster than the fighters sent after it.', 'De_Havilland_Mosquito'),
    w('Consolidated PBY Catalina', 'The long-range flying boat that found the Bismarck and rescued thousands of downed airmen.', 'Consolidated_PBY_Catalina'),
    w('Messerschmitt Me 262', 'The first operational jet fighter, 1944, 100 mph faster than anything the Allies had.', 'Messerschmitt_Me_262'),
    w('Gloster Meteor', 'The only Allied jet to see combat in the Second World War, chasing V-1 flying bombs.', 'Gloster_Meteor'),
    w('Bell X-1', 'Chuck Yeager broke the sound barrier in it on 14 October 1947.', 'Bell_X-1'),
    w('North American X-15', 'Rocket plane that reached Mach 6.7 and 354,000 ft, the edge of space, in the 1960s.', 'North_American_X-15'),
    w('North American F-86 Sabre', 'The swept-wing American fighter of the Korean War, matched against the MiG-15.', 'North_American_F-86_Sabre'),
    w('Mikoyan-Gurevich MiG-15', 'The Soviet swept-wing jet that shocked the West over Korea in 1950.', 'Mikoyan-Gurevich_MiG-15'),
    w('Lockheed F-104 Starfighter', 'The missile with a man in it: Mach 2 with stubby razor-edged wings.', 'Lockheed_F-104_Starfighter'),
    w('McDonnell Douglas F-4 Phantom II', 'The big twin-engine fighter of Vietnam, flown by the Air Force, Navy and Marines alike.', 'McDonnell_Douglas_F-4_Phantom_II'),
    w('Grumman F-14 Tomcat', 'Swing-wing Navy interceptor with the Phoenix missile, and the star of Top Gun.', 'Grumman_F-14_Tomcat'),
    w('Republic F-105 Thunderchief', 'The Thud: the heavy strike fighter that carried the war to North Vietnam.', 'Republic_F-105_Thunderchief'),
    w('Douglas A-1 Skyraider', 'Piston-engined attack aircraft that flew rescue cover and close support in Vietnam long into the jet age.', 'Douglas_A-1_Skyraider'),
    w('Bell UH-1 Iroquois', 'The Huey: the sound of the Vietnam War and the first turbine helicopter in mass service.', 'Bell_UH-1_Iroquois'),
    w('Bell AH-1 Cobra', 'The first dedicated attack helicopter, built on Huey parts in 1965.', 'Bell_AH-1_Cobra'),
    w('Sikorsky R-4', 'The first helicopter in production and military service, 1944.', 'Sikorsky_R-4'),
    w('Bell 47', 'The first helicopter certified for civil use, 1946, with the bubble canopy from M*A*S*H.', 'Bell_47'),
    w('Lockheed SR-71 Blackbird', 'Mach 3.3 at 85,000 ft. Nothing ever caught one. Retired in 1999.', 'Lockheed_SR-71_Blackbird'),
    w('Convair B-36 Peacemaker', 'Six turning, four burning: the largest piston bomber ever built.', 'Convair_B-36_Peacemaker'),
    w('Boeing B-47 Stratojet', 'The swept-wing jet bomber whose layout became every airliner since.', 'Boeing_B-47_Stratojet'),
    w('Convair B-58 Hustler', 'The first supersonic bomber, a Mach 2 delta with its weapons in a pod.', 'Convair_B-58_Hustler'),
    w('North American XB-70 Valkyrie', 'Mach 3 bomber prototype that rode its own shock wave on folding wingtips.', 'North_American_XB-70_Valkyrie'),
    w('Avro Vulcan', 'Britain’s delta-wing nuclear bomber, which flew the longest bombing raid in history to the Falklands in 1982.', 'Avro_Vulcan'),
    w('English Electric Lightning', 'British Mach 2 interceptor with two engines stacked one above the other and a ferocious climb.', 'English_Electric_Lightning'),
    w('Hawker Hunter', 'Elegant British 1950s fighter that set a world speed record and flew for 20 air forces.', 'Hawker_Hunter'),
    w('Dassault Mirage III', 'The French delta that won the 1967 Six-Day War for Israel and sold around the world.', 'Dassault_Mirage_III'),
    w('Hughes H-4 Hercules', 'The Spruce Goose: the largest wingspan ever flown, once, for a mile, in 1947.', 'Hughes_H-4_Hercules'),
    w('Boeing 314 Clipper', 'Pan Am’s flying boat that opened transatlantic and transpacific passenger service in 1939.', 'Boeing_314_Clipper'),
    w('Lockheed Constellation', 'The triple-tailed pressurised airliner that made coast-to-coast flying routine after the war.', 'Lockheed_Constellation'),
    w('de Havilland Comet', 'The first jet airliner, 1952, and the hard lesson in metal fatigue when three broke up in flight.', 'De_Havilland_Comet'),
    w('Boeing 707', 'The jet that started the jet age for the airlines in 1958.', 'Boeing_707'),
    w('Douglas DC-8', 'Boeing’s rival in the first jet age; one broke the sound barrier in a 1961 test dive.', 'Douglas_DC-8'),
    w('Sud Aviation Caravelle', 'The first short-haul jet airliner, and the first with rear-mounted engines.', 'Sud_Aviation_Caravelle'),
    w('Vickers Viscount', 'The first turboprop airliner, 1950, loved for its quiet cabin and big windows.', 'Vickers_Viscount'),
    w('Boeing 747-100', 'The first Jumbo Jet, 1969, which made long-haul flying affordable.', 'Boeing_747'),
    w('Concorde', 'The supersonic airliner: Mach 2 across the Atlantic in three and a half hours, 1976 to 2003.', 'Concorde'),
    w('Tupolev Tu-144', 'The Soviet supersonic airliner that flew first but lasted only 55 passenger flights.', 'Tupolev_Tu-144'),
    w('Rutan Voyager', 'First aircraft to fly around the world non-stop without refuelling, in nine days, 1986.', 'Rutan_Voyager'),
    w('Gossamer Albatross', 'Human-powered aircraft that was pedalled across the English Channel in 1979.', 'MacCready_Gossamer_Albatross'),
    w('Northrop YB-49', 'Jet flying-wing bomber of 1947 whose shape returned as the B-2 forty years later.', 'Northrop_YB-49')
  ];

  // ---------- Workout: Monday, Wednesday and Friday ----------
  var WORKOUT = [
    { t: 'Push Day', d: 'Push-ups 3 × 12 · Chair dips 3 × 10 · Pike push-ups 3 × 8 · Plank 3 × 45 s. Rest 60 to 90 seconds between sets.' },
    { t: 'Leg Day', d: 'Bodyweight squats 4 × 15 · Walking lunges 3 × 10 each leg · Glute bridges 3 × 15 · Calf raises 3 × 20.' },
    { t: 'Pull and Core', d: 'Pull-ups or inverted rows 3 × 8 · Supermans 3 × 12 · Dead bugs 3 × 10 each side · Side plank 3 × 30 s each side.' },
    { t: 'Full-Body Circuit', d: 'Three rounds, little rest: Burpees 10 · Mountain climbers 30 s · Jump squats 12 · Plank 45 s. Rest 2 minutes between rounds.' },
    { t: 'Dumbbell Upper', d: 'One-arm rows 3 × 12 · Overhead press 3 × 10 · Biceps curls 3 × 12 · Overhead triceps extension 3 × 12.' },
    { t: 'Dumbbell Lower', d: 'Goblet squats 4 × 12 · Romanian deadlifts 3 × 12 · Step-ups 3 × 10 each leg · Farmer carry 3 × 40 m.' },
    { t: 'Core Focus', d: 'Crunches 3 × 20 · Lying leg raises 3 × 12 · Russian twists 3 × 20 · Hollow hold 3 × 30 s.' },
    { t: 'Cardio and Strength', d: 'Run, bike or row 15 minutes at a steady pace · Push-ups 3 × 15 · Squats 3 × 20 · Plank 2 × 60 s.' },
    { t: 'Kettlebell Day', d: 'Swings 4 × 15 · Goblet squats 3 × 12 · Push press 3 × 10 · Suitcase carry 3 × 30 m each hand. A dumbbell works too.' },
    { t: 'Upper-Body Endurance', d: 'Push-ups 4 sets to near failure, 60 s rest · Inverted rows 4 × 10 · Shoulder taps 3 × 20 · Plank 3 × 45 s.' },
    { t: 'Lower-Body Power', d: 'Jump squats 3 × 10 · Reverse lunges 3 × 12 each leg · Wall sit 3 × 45 s · Single-leg calf raises 3 × 15 each.' },
    { t: 'Mobility and Core', d: 'Bird dogs 3 × 10 each side · Glute bridges 3 × 15 · Dead bugs 3 × 10 · Cat-cow, hip flexor and hamstring stretches, 5 minutes.' }
  ];

  var CATEGORIES = [
    { id: 'emerg', label: 'Emergency Procedure', items: EMERG, offset: 0 },
    { id: 'checklist', label: 'Checklist Procedure', items: CHECKLIST, offset: 3 },
    { id: 'reg', label: 'Regulation', items: REG, offset: 7 },
    { id: 'phrase', label: 'Phraseology', items: PHRASE, offset: 11 },
    { id: 'mishap', label: 'Mishap', items: MISHAP, offset: 5 },
    { id: 'aircraft', label: 'Aircraft', items: AIRCRAFT, offset: 9 },
    { id: 'mil', label: 'Military Aircraft', items: MIL, offset: 13 },
    { id: 'hist', label: 'Historical Aircraft', items: HIST, offset: 17 },
    { id: 'workout', label: 'Workout', items: null, offset: 0 }
  ];

  // Days since 1 January 1970 in the visitor's local calendar, so the set
  // changes at local midnight and never repeats on New Year's Day.
  function dayNumber(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  // Monday, Wednesday and Friday train; the pool cycles over four weeks.
  function workoutFor(d) {
    var dow = d.getDay(), slot = { 1: 0, 3: 1, 5: 2 }[dow];
    if (slot == null) {
      var next = dow === 0 || dow === 6 ? 'Monday' : dow === 2 ? 'Wednesday' : 'Friday';
      return { t: 'Off day', off: true, d: 'No workout today. Rest, stretch, or take a walk. The next workout is ' + next + '. Training days are Monday, Wednesday and Friday.' };
    }
    var week = Math.floor((dayNumber(d) + 3) / 7);           // weeks since epoch, Monday-based
    return WORKOUT[(week * 3 + slot) % WORKOUT.length];
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(cat, item) {
    var node = item.u ? el('a', 'otd-card') : el('div', 'otd-card');
    if (item.u) { node.href = item.u; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    else node.tabIndex = 0;
    node.classList.add('otd-' + cat.id);
    if (item.off) node.classList.add('otd-off');
    var label = cat.label + ' of the Day';
    node.appendChild(el('span', 'otd-cat', label));
    node.appendChild(el('span', 'otd-title', item.t));
    node.appendChild(el('span', 'otd-desc', item.d));
    // The hover panel lays over the card so the grid does not reflow. It
    // repeats the heading, and is hidden from screen readers, which get
    // the inline description above.
    var pop = el('span', 'otd-pop');
    pop.setAttribute('aria-hidden', 'true');
    pop.appendChild(el('span', 'otd-cat', label));
    pop.appendChild(el('span', 'otd-title', item.t));
    pop.appendChild(el('span', 'otd-desc', item.d));
    if (item.u) pop.appendChild(el('span', 'otd-more', 'Read more \u2197'));
    node.appendChild(pop);
    return node;
  }

  function render(date) {
    var d = date || new Date();
    var dateEl = document.getElementById('otd-date');
    if (dateEl) {
      dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      dateEl.setAttribute('datetime', d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    var grid = document.getElementById('otd-grid');
    if (!grid) return;
    grid.textContent = '';
    var n = dayNumber(d);
    CATEGORIES.forEach(function (cat) {
      var item = cat.items ? cat.items[(n + cat.offset) % cat.items.length] : workoutFor(d);
      grid.appendChild(card(cat, item));
    });
  }

  window.OTD = { render: render, CATEGORIES: CATEGORIES, WORKOUT: WORKOUT, workoutFor: workoutFor };

  function init() {
    render();
    // Roll over at local midnight if the page is left open.
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(function () { render(); setInterval(render, 86400000); }, next - now);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
