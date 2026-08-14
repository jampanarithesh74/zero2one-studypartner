import { QuizQuestion } from "./quizQuestions";

export interface CrosswordClue {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer: string;
  row: number; // 0-indexed starting row
  col: number; // 0-indexed starting col
}

export interface CrosswordActivity {
  id: string;
  title: string;
  theme: string;
  description: string;
  gridRows: number;
  gridCols: number;
  clues: CrosswordClue[];
}

export interface RiddleItem {
  id: number;
  title: string;
  riddleText: string;
  hint: string;
  answer: string; // sanitized uppercase
  explanation: string;
  tags: string[];
}

export const ENGINEERING_FAILURE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "1. [EEE] In the 2021 Texas Power Grid failure (Winter Storm Uri), what was the primary root cause that triggered statewide emergency blackouts?",
    options: [
      "Sudden hurricane-force wind destruction of high-voltage transmission lines",
      "Freezing of un-winterized natural gas wellheads, pipelines, and power generation equipment causing a massive supply deficit",
      "A sophisticated cyberattack on the regional SCADA distribution network",
      "Failure of emergency cooling loops in Texas nuclear power stations"
    ],
    correctOptionIndex: 1,
    explanation: "Extreme freezing conditions incapacitated un-winterized natural gas supply chains, instrumentation, and power generation units, creating an unprecedented 34 GW power shortfall that nearly caused total grid collapse."
  },
  {
    id: 2,
    text: "2. [ECE] During India's Chandrayaan-1 lunar mission in 2009, what technical issue ultimately caused the early termination of the spacecraft's mission?",
    options: [
      "Premature propellant exhaustion during lunar orbit insertion burns",
      "Severe overheating of the Star Sensor and DC-DC power converter failure in the harsh lunar thermal environment",
      "Physical loss of the primary X-band high-gain communications antenna",
      "Micrometeoroid penetration puncturing the main avionics bus"
    ],
    correctOptionIndex: 1,
    explanation: "Severe thermal radiation in lunar orbit caused the star tracker sensors and DC-DC power converter units to overheat and fail, leading to loss of attitude control telemetry."
  },
  {
    id: 3,
    text: "3. [MECH] What critical mechanical failure mechanism prompted the major nationwide recall of Samsung top-load washing machines in 2016?",
    options: [
      "Electrical short-circuiting in heating elements triggering laundry fires",
      "Excessive vibration during high-speed spin cycles causing chassis support rods to uncouple and the top lid to detach violently",
      "Cavitation erosion of the drain pump impeller leading to flooded residences",
      "Intergranular stress corrosion cracking of the internal stainless steel drum"
    ],
    correctOptionIndex: 1,
    explanation: "When washing bulky or water-resistant loads, high-speed spin cycles induced severe dynamic resonance imbalances, uncoupling the support rods and blowing the top cover violently off the chassis."
  },
  {
    id: 4,
    text: "4. [CIVIL] What was the critical engineering and safety oversight in the 2018 Florida International University (FIU) pedestrian bridge collapse?",
    options: [
      "The bridge structure was struck by an oversized transport vehicle on the roadway below",
      "Severe nodal diagonal shear cracks at connection 11/12 were overlooked, and post-tensioning rods were re-tensioned without closing traffic below",
      "Substandard concrete mix aggregate chemically disintegrated from acid rain",
      "Foundation soil liquefaction caused by sudden subterranean water main rupture"
    ],
    correctOptionIndex: 1,
    explanation: "Extensive diagonal shear cracks at node 11/12 were dismissed as cosmetic. While crews attempted to re-tension post-tensioning rods over active traffic without closing the road, the nodal connection experienced catastrophic shear failure."
  },
  {
    id: 5,
    text: "5. [CSE] In the 1996 Ariane 5 Flight 501 launch explosion, what software engineering defect led to self-destruction 37 seconds after liftoff?",
    options: [
      "A stack buffer overflow vulnerability in the radio telemetry parser",
      "An unhandled 64-bit floating point to 16-bit signed integer conversion overflow in reused Ariane 4 inertial guidance software",
      "A memory leak in the C++ propulsion gimbal control thread",
      "A divide-by-zero runtime exception in the atmospheric density calculation"
    ],
    correctOptionIndex: 1,
    explanation: "Software reused from Ariane 4 attempted to convert a 64-bit float (Horizontal Bias) into a 16-bit signed integer. The greater horizontal acceleration of Ariane 5 exceeded the 16-bit limit (+32,767), triggering an uncaught exception that shut down both primary and backup computers."
  },
  {
    id: 6,
    text: "6. [DS] Why did Zillow's algorithmic home-buying business (Zillow Offers) fail catastrophically in 2021, incurring hundreds of millions in losses?",
    options: [
      "The web app suffered continuous denial-of-service outages preventing offer submissions",
      "The machine learning pricing model (Zestimate) overfitted historical trends and failed to adapt to sudden housing market shifts and volatility",
      "Blockchain smart contract settlement fees eliminated profit margins",
      "Federal antitrust authorities prohibited all automated valuation algorithms"
    ],
    correctOptionIndex: 1,
    explanation: "The automated valuation model was over-tuned to win bids in an aggressive market, unable to forecast price decelerations and inventory holding costs, causing Zillow to purchase homes above market value and liquidate at steep losses."
  },
  {
    id: 7,
    text: "7. [CS] What cybersecurity vulnerability allowed the BlackCat ransomware group to breach Change Healthcare in 2024 and disrupt nationwide healthcare payments?",
    options: [
      "A zero-day remote code execution exploit in Linux kernel drivers",
      "Compromised credentials on a remote access Citrix portal that lacked Multi-Factor Authentication (MFA)",
      "Physical theft of unencrypted backup drives from a regional server vault",
      "BGP route hijacking redirecting medical EDI transactions to adversary servers"
    ],
    correctOptionIndex: 1,
    explanation: "Threat actors gained initial entry using stolen legitimate corporate login credentials on an external-facing Citrix remote access portal that did not have multi-factor authentication (MFA) enabled."
  },
  {
    id: 8,
    text: "8. [AI] In the xAI Grok chatbot compromise controversy, how did researchers and users bypass the AI model's guardrails to generate disallowed content?",
    options: [
      "Injecting compiled malicious binary shellcode directly into GPU VRAM",
      "Using adversarial prompt injection, linguistic framing, and hypothetical roleplaying tricks to circumvent safety filters",
      "Deleting system guardrail tables using SQL injection",
      "Flooding the transformer attention heads with petabytes of noise tokens"
    ],
    correctOptionIndex: 1,
    explanation: "Adversarial prompt injection and conversational jailbreaks exploited semantic vulnerabilities in the model's instruction tuning, tricking the LLM into ignoring system safety guardrails."
  },
  {
    id: 9,
    text: "9. [AIML] In the 2018 fatal Uber autonomous vehicle crash in Tempe, Arizona, what primary computer vision failure occurred in the perception pipeline?",
    options: [
      "Total hardware failure of all LiDAR and radar sensor arrays",
      "Classification 'flickering' and lack of track history continuity for a jaywalking pedestrian pushing a bicycle",
      "GPS satellite spoofing confusing the vehicle's localization map",
      "Mechanical seizure of the steer-by-wire electromechanical actuator"
    ],
    correctOptionIndex: 1,
    explanation: "The perception system detected the victim 6 seconds before impact but repeatedly shifted classifications between vehicle, unknown object, and bicycle, resetting its predicted velocity and trajectory and suppressing emergency braking."
  },
  {
    id: 10,
    text: "10. [IT] What single operational failure caused Toyota to shut down all 14 vehicle assembly plants in Japan in August 2023?",
    options: [
      "A crippling ransomware attack on industrial PLC controller networks",
      "Production ordering servers ran completely out of disk storage space during scheduled database maintenance",
      "An undersea communications fiber severance isolating Japan from global cloud centers",
      "A regional electrical blackout across all assembly plants in Aichi prefecture"
    ],
    correctOptionIndex: 1,
    explanation: "During scheduled database maintenance, servers managing parts delivery ran out of disk storage space, halting the Just-In-Time production system across 28 assembly lines in all 14 domestic plants."
  }
];

export const CROSSWORD_ACTIVITIES: CrosswordActivity[] = [
  {
    id: "crossword-terminology",
    title: "Crossword A: Failure Analysis Terminology",
    theme: "Engineering Failure Modes & Incident Vocabulary",
    description: "Fill in the specific terminology and failure analysis concepts from the 10 case studies.",
    gridRows: 10,
    gridCols: 10,
    clues: [
      {
        number: 1,
        direction: "across",
        clue: "EEE: What the energy-rich state did when it went dark (6 letters)",
        answer: "FREEZE",
        row: 0,
        col: 0
      },
      {
        number: 2,
        direction: "across",
        clue: "ECE: The extreme condition in lunar orbit (4 letters)",
        answer: "HEAT",
        row: 2,
        col: 0
      },
      {
        number: 3,
        direction: "across",
        clue: "MECH: High-speed action causing vibrations (4 letters)",
        answer: "SPIN",
        row: 4,
        col: 0
      },
      {
        number: 4,
        direction: "across",
        clue: "CIVIL: Major structural indicator on the new bridge (5 letters)",
        answer: "CRACK",
        row: 6,
        col: 0
      },
      {
        number: 5,
        direction: "across",
        clue: "AI: Simple manipulation used to break guardrails (6 letters)",
        answer: "TRICKS",
        row: 8,
        col: 0
      },
      {
        number: 6,
        direction: "across",
        clue: "IT: The type of single database storage issue (5 letters)",
        answer: "ERROR",
        row: 9,
        col: 5
      },
      {
        number: 7,
        direction: "down",
        clue: "EEE: Temperatures dropped below this number (4 letters)",
        answer: "ZERO",
        row: 0,
        col: 7
      },
      {
        number: 8,
        direction: "down",
        clue: "ECE: The lunar path where the electronics disabled (5 letters)",
        answer: "ORBIT",
        row: 0,
        col: 9
      },
      {
        number: 9,
        direction: "down",
        clue: "AI: Safety features broken by the chatbot (6 letters)",
        answer: "GUARDS",
        row: 4,
        col: 5
      },
      {
        number: 10,
        direction: "down",
        clue: "CS: The two-step process missing from the stolen password (5 letters)",
        answer: "LOGIN",
        row: 4,
        col: 7
      },
      {
        number: 11,
        direction: "down",
        clue: "AIML: What the self-driving car failed to do (5 letters)",
        answer: "BRAKE",
        row: 4,
        col: 9
      },
      {
        number: 12,
        direction: "down",
        clue: "DS: The algorithm bought homes at inflated ones (6 letters)",
        answer: "PRICES",
        row: 2,
        col: 4
      }
    ]
  },
  {
    id: "crossword-equipment",
    title: "Crossword B: Equipment & Systems Failure",
    theme: "Engineering Components, Digital Systems & Physical Assets",
    description: "Identify the critical equipment, software, and industrial facilities from the failure case studies.",
    gridRows: 10,
    gridCols: 10,
    clues: [
      {
        number: 1,
        direction: "across",
        clue: "EEE: The Texas power system that failed (4 letters)",
        answer: "GRID",
        row: 0,
        col: 0
      },
      {
        number: 2,
        direction: "across",
        clue: "CIVIL: The FIU structure left open to traffic (6 letters)",
        answer: "BRIDGE",
        row: 2,
        col: 0
      },
      {
        number: 3,
        direction: "across",
        clue: "CSE: The Ariane 5 flight vehicle (6 letters)",
        answer: "ROCKET",
        row: 4,
        col: 0
      },
      {
        number: 4,
        direction: "across",
        clue: "AI: What xAI Grok is classified as (7 letters)",
        answer: "CHATBOT",
        row: 6,
        col: 0
      },
      {
        number: 5,
        direction: "across",
        clue: "IT: Where the single storage error occurred (8 letters)",
        answer: "DATABASE",
        row: 8,
        col: 0
      },
      {
        number: 6,
        direction: "across",
        clue: "IT: The entire auto giant facility that halted (7 letters)",
        answer: "FACTORY",
        row: 9,
        col: 0
      },
      {
        number: 7,
        direction: "down",
        clue: "MECH: The Samsung appliance recalled (6 letters)",
        answer: "WASHER",
        row: 0,
        col: 8
      },
      {
        number: 8,
        direction: "down",
        clue: "MECH: The support parts that snapped (4 letters)",
        answer: "RODS",
        row: 0,
        col: 6
      },
      {
        number: 9,
        direction: "down",
        clue: "MECH: The part torn off the machine (3 letters)",
        answer: "LID",
        row: 0,
        col: 7
      },
      {
        number: 10,
        direction: "down",
        clue: "CSE: Reused instructions from an older rocket (8 letters)",
        answer: "SOFTWARE",
        row: 0,
        col: 9
      },
      {
        number: 11,
        direction: "down",
        clue: "DS: The automated system that bought homes without oversight (4 letters)",
        answer: "CODE",
        row: 3,
        col: 7
      },
      {
        number: 12,
        direction: "down",
        clue: "CS: The single stolen credential (4 letters)",
        answer: "PASS",
        row: 5,
        col: 8
      }
    ]
  }
];

export const RIDDLE_ACTIVITIES: RiddleItem[] = [
  {
    id: 1,
    title: "Riddle 1: EEE — Texas Power Grid",
    riddleText: "I am an energy-rich state, but I was left in the dark when temperatures dropped. My failure was caused by water turning solid.",
    hint: "The physical state change that happens below zero.",
    answer: "FREEZE",
    explanation: "During 2021 Winter Storm Uri, freezing temperatures disabled un-winterized natural gas wells and generation equipment, triggering emergency statewide blackouts.",
    tags: ["EEE", "Texas Grid", "Winter Storm Uri"]
  },
  {
    id: 2,
    title: "Riddle 2: MECH — Samsung Washing Machine",
    riddleText: "I am the rapid motion that causes high-speed vibrations. Because of me, support rods snapped and a lid tore off.",
    hint: "A rapid circular movement.",
    answer: "SPIN",
    explanation: "Dynamic unbalance during high-speed spin cycles on recalled Samsung top-load washing machines broke chassis support rods and caused the lid to violently detach.",
    tags: ["MECH", "Samsung Recall", "Dynamic Vibration"]
  },
  {
    id: 3,
    title: "Riddle 3: CSE — Ariane 5 Flight 501",
    riddleText: "I am the set of digital instructions that was taken from an older rocket. Because I was applied where I didn't belong, a $500M mission exploded.",
    hint: "Another word for computer programs or scripts.",
    answer: "CODE",
    explanation: "Ariane 5 reused Ariane 4 inertial alignment software without re-testing for higher horizontal velocity, resulting in a fatal 64-to-16 bit conversion overflow.",
    tags: ["CSE", "Ariane 5", "Software Reusability"]
  },
  {
    id: 4,
    title: "Riddle 4: AIML — Uber Autonomous Vehicle Crash",
    riddleText: "I am what the self-driving car failed to do because its AI couldn't decide what a pedestrian was.",
    hint: "The mechanism used to stop a moving vehicle.",
    answer: "BRAKE",
    explanation: "The autonomous perception software suffered from classification flickering, repeatedly resetting its prediction trajectory and suppressing emergency braking until impact.",
    tags: ["AIML", "Uber Crash", "Perception Pipeline"]
  },
  {
    id: 5,
    title: "Riddle 5: IT — Toyota Factory Shutdown",
    riddleText: "I am what the database ran out of. Because of this single error, an entire auto giant's factory came to a halt.",
    hint: "The capacity to keep or hold data.",
    answer: "STORAGE",
    explanation: "Toyota halted all 14 assembly plants in Japan when database servers ran out of disk storage space during routine maintenance, freezing the parts ordering system.",
    tags: ["IT", "Toyota Shutdown", "Disk Space Exhaustion"]
  }
];
