
export interface Subject {
  code: string;
  title: string;
  credits: number;
  type: string; // BS, ES, HS, PC etc.
}

export interface SyllabusDetail {
  title: string;
  outcomes: string[];
  units: {
    title: string;
    content: string;
  }[];
}

export const DEPARTMENTS = [
  "Artificial Intelligence",
  "AI & Machine Learning",
  "Computer Science and Engineering",
  "Information Technology",
  "CSE (Data Science)",
  "CSE (Cyber Security)",
  "Electrical & Electronics Engineering",
  "Electronics & Communication Engineering",
  "Electronics & Computer Engineering",
  "Civil Engineering",
  "Mechanical Engineering"
];

export const SYLLABUS_MAP: Record<string, { [key: number]: Subject[] }> = {
  "Artificial Intelligence": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "ESE1125", title: "Data Analytics Practices", credits: 1, type: "PC" },
    ],
    2: [
      { code: "EMI1201", title: "Ordinary Differential Equations and Numerical Techniques", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1224", title: "Introduction to Generative AI", credits: 2, type: "PC" },
    ]
  },
  "AI & Machine Learning": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "ESE1125", title: "Data Analytics Practices", credits: 1, type: "PC" },
    ],
    2: [
      { code: "EMI1201", title: "Ordinary Differential Equations and Numerical Techniques", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1224", title: "Introduction to Generative AI", credits: 2, type: "PC" },
    ]
  },
  "Computer Science and Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMI1X24", title: "Emerging Technologies (MOOCs)", credits: 2, type: "PC" },
    ],
    2: [
       { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
       { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
       { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
       { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
       { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
       { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
       { code: "EVA1222", title: "Problem Solving using Global Coding Platform", credits: 1, type: "PC" },
    ]
  },
  "Information Technology": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1119", title: "Essentials of Information Technology", credits: 1, type: "PC" },
    ],
    2: [
      { code: "EMI1201", title: "Ordinary Differential Equations and Numerical Techniques", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1207", title: "Linux Programming", credits: 2, type: "PC" },
    ]
  },
  "CSE (Data Science)": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "ESE1125", title: "Data Analytics Practices", credits: 1, type: "PC" },
    ],
    2: [
      { code: "EMI1201", title: "Ordinary Differential Equations and Numerical Techniques", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMI1206", title: "Statistical foundations for Data Science", credits: 2, type: "BS" },
    ]
  },
  "CSE (Cyber Security)": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1120", title: "Essentials of Cyber Security", credits: 1, type: "PC" },
    ],
    2: [
      { code: "EMI1201", title: "Ordinary Differential Equations and Numerical Techniques", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1207", title: "Linux Programming", credits: 2, type: "PC" },
    ]
  },
  "Electrical & Electronics Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1107", title: "Energy, Environment and Sustainability", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1206", title: "Electrical Circuits", credits: 2, type: "PC" },
    ]
  },
  "Electronics & Communication Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1107", title: "Energy, Environment and Sustainability", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1223", title: "Familiarization of Electronic Components and Instruments", credits: 1, type: "PC" },
    ]
  },
  "Electronics & Computer Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1107", title: "Energy, Environment and Sustainability", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1223", title: "Familiarization of Electronic Components and Instruments", credits: 1, type: "PC" },
    ]
  },
  "Civil Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1101", title: "Engineering Mechanics - I", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "EMA1201", title: "Engineering Mechanics - II", credits: 2, type: "PC" },
    ]
  },
  "Mechanical Engineering": {
    1: [
      { code: "EMI1101", title: "Linear Algebra and Calculus", credits: 4, type: "BS" },
      { code: "EMD1X06", title: "Engineering Chemistry", credits: 4, type: "BS" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1105", title: "Engineering Mechanics", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X23", title: "Effective Communication Skills", credits: 1, type: "HS" },
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EVA1221", title: "Joy of Engineering - II", credits: 3, type: "ES" },
      { code: "ESE1222", title: "Engineering Graphics", credits: 1, type: "PC" },
    ]
  }
};

// Simplified syllabus details for key subjects
export const SUBJECT_DETAILS: Record<string, SyllabusDetail> = {
  "EMI1101": {
    title: "Linear Algebra and Calculus",
    outcomes: [
      "Write matrix representation of linear equations.",
      "Find Eigen values and vectors.",
      "Apply mean value theorems."
    ],
    units: [
      { title: "UNIT I: Matrices and Linear System of Equations", content: "Real and Complex matrices, Rank - Echelon form, Normal form, Solution of Linear Systems by Gauss Elimination Method." },
      { title: "UNIT II: Eigen Values and Eigen Vectors", content: "Eigen values, Eigen vectors –properties, Cayley-Hamilton Theorem (without Proof) and its applications – Diagonalization of a matrix." },
      { title: "UNIT III: Vector Spaces, Basis ad Dimension", content: "Vector space, Sub space, linear combination of vectors, Linear dependence and independence of vectors, linear span, basis and dimension." },
      { title: "UNIT IV: Single Variable Calculus", content: "Rolle’s Theorem, Lagrange’s mean value theorem, Cauchy’s mean value theorem, Generalized Mean Value theorem." },
      { title: "UNIT V: Multi-Variable Calculus", content: "Partial Differentiation and total differentiation, Functional dependence, Jacobian Determinant Maxima and Minima." }
    ]
  },
  "EMD1X06": {
    title: "Engineering Chemistry",
    outcomes: ["Understand atomic configurations.", "Apply knowledge of corrosion control."],
    units: [
      { title: "UNIT I: Molecular structure and Spectroscopy", content: "Introduction, Concept of atomic and molecular orbitals, LCAO, Molecular orbitals of diatomic molecules." },
      { title: "UNIT II: Water Technology", content: "Hardness of water, EDTA method, potable water treatment, desalination." },
      { title: "UNIT III: Electrochemistry and Batteries", content: "Electrode potential, galvanic cell, Nernst equation, lithium cells, fuel cells." },
      { title: "UNIT IV: Corrosion and its control", content: "Chemical and electrochemical corrosion, cathodic protection, protective coatings." },
      { title: "UNIT V: Engineering Materials", content: "Polymers, thermoplastics, refractories." }
    ]
  },
  "EMA1102": {
    title: "Programming in C",
    outcomes: ["Develop algorithms.", "Implement programs using arrays and strings."],
    units: [
      { title: "UNIT I: Introduction", content: "Block diagram, binary number system, C preliminaries, operators." },
      { title: "UNIT II: Control Structures", content: "Decision statements, loops (while, do-while, for)." },
      { title: "UNIT III: Arrays and Strings", content: "1D/2D arrays, string operations." },
      { title: "UNIT IV: Functions", content: "Storage classes, parameter passing, recursion." },
      { title: "UNIT V: Sorting and Searching", content: "Linear/Binary search, bubble/insertion/selection sort." }
    ]
  },
  "EMD1X07": {
    title: "Engineering Physics",
    outcomes: ["Understand quantum mechanics.", "Apply principles of lasers and optical fibers."],
    units: [
      { title: "UNIT I: Quantum Mechanics", content: "Wave-particle duality, Heisenberg’s uncertainty principle, Schrödinger wave equations." },
      { title: "UNIT II: Lasers and Optical Fibres", content: "Spontaneous/stimulated emission, Einstein coefficients, fiber optic communication." },
      { title: "UNIT III: Semiconductors", content: "Energy bands, Fermi-Dirac distribution, intrinsic/extrinsic semiconductors." },
      { title: "UNIT IV: Semiconductor Devices", content: "P-N junction diode, Zener diode, Bipolar junction transistor." },
      { title: "UNIT V: Optoelectronic Devices", content: "Radiative recombination, LED, semiconductor laser, photodiode, solar cell." }
    ]
  },
  "EMA1204": {
    title: "Data Structures",
    outcomes: ["Implement stacks and queues.", "Understand structures and pointers."],
    units: [
      { title: "UNIT I: Structures", content: "Definition, initialization, nested structures, unions, typedef." },
      { title: "UNIT II: Pointers", content: "Pointer arithmetic, dynamic memory allocation, pointers to structures." },
      { title: "UNIT III: Linear Data Structures", content: "Stacks and Queues, implementation using arrays and applications." },
      { title: "UNIT IV: Linked Lists", content: "Singly linked lists, circular queue, implementation using dynamic memory." },
      { title: "UNIT V: Advanced Linked Lists", content: "Double linked lists, complex operations (insert/delete/search)." }
    ]
  },
  "EMI1201": {
    title: "Ordinary Differential Equations and Numerical Techniques",
    outcomes: ["Classify differential equations.", "Solve first order initial value problems."],
    units: [
      { title: "Unit I: Differential Equations of first order", content: "Formation, exact, linear and Bernoulli, applications to Newton’s law of cooling." },
      { title: "Unit II: Higher Order Linear Differential Equations", content: "Second and higher order with constant coefficients, Method of variation of parameters." },
      { title: "Unit III: Solution of Non-linear Equations", content: "Bisection Method, Method of False Position, Newton-Raphson Method." },
      { title: "Unit IV: Interpolation & Numerical integration", content: "Finite differences, Newton’s forward/backward interpolation, Trapezoidal rule, Simpson’s rules." },
      { title: "Unit V: Numerical solution of ODEs", content: "Taylor’s series, Picard’s Method, Euler and modified Euler’s methods, Runge-Kutta Method." }
    ]
  },
  "EMI1202": {
    title: "Ordinary Differential Equations and Vector Calculus",
    outcomes: ["Evaluate Double and Triple integrals.", "Identify vector differential operators."],
    units: [
      { title: "UNIT I: First Order Differential Equations", content: "Formation, applications to Newton’s law of cooling, growth and decay." },
      { title: "UNIT II: Higher Order Equations", content: "Linear equations with constant coefficients, Method of variation of parameters." },
      { title: "UNIT III: Multiple Integrals", content: "Double and triple integrals, change of order, change of variables (Cartesian to Polar)." },
      { title: "UNIT IV: Vector Differentiation", content: "Gradient, Divergence, Curl, Directional Derivatives, Solenoidal and Irrotational vectors." },
      { title: "UNIT V: Vector Integration", content: "Line integral, work done, Surface and Volume integrals, Green’s, Stoke’s and Gauss Divergence Theorems." }
    ]
  },
  "EMA1107": {
    title: "Energy, Environment and Sustainability",
    outcomes: ["Interrelate energy and environment.", "Summarize clean energy initiatives."],
    units: [
      { title: "Unit-1: Energy", content: "Nexus between energy and environment, global & India’s energy scenario." },
      { title: "Unit-2: Energy Sources", content: "Fossil fuels, biomass, wind, solar, wave, tidal and hydrogen." },
      { title: "Unit-3: Environmental Impacts", content: "Climate change, Global warming, Net Zero emissions, impacts and mitigation." },
      { title: "Unit-4: Sustainability Concepts", content: "SDGs, Emerging Issues in Energy Access, Technologies and Economics." },
      { title: "Unit-5: Sustainable Energy", content: "Engine of Sustainable Development, Aspects of Energy Production." }
    ]
  },
  "EMA1101": {
    title: "Engineering Mechanics - I",
    outcomes: ["Find resolution of coplanar force systems.", "Assess centroids and moment of inertia."],
    units: [
      { title: "UNIT I: Coplanar Force Systems", content: "Parallelogram law, resultant of concurrent forces, moment of force, couple." },
      { title: "UNIT II: Spatial Force Systems", content: "Components of forces in space, vector algebra, dot and cross product." },
      { title: "UNIT III: Equilibrium", content: "Free body diagrams, equations of equilibrium, general planar systems." },
      { title: "UNIT IV: Friction", content: "Theory of friction, angle of friction, wedge, ladder and belt friction." },
      { title: "UNIT V: Centroids and Centers of Gravity", content: "Center of gravity of flat plate, centroids by integration, composite figures." }
    ]
  },
  "EMI1X04": {
    title: "Basic Electrical and Electronics Engineering",
    outcomes: ["Understand DC circuit theorems.", "Acquire knowledge on electronic devices."],
    units: [
      { title: "UNIT I: DC Circuits", content: "Kirchhoff’s Laws, series/parallel resistive circuits, Superposition and Thevenin’s theorems." },
      { title: "UNIT II: AC Circuits", content: "Single-phase AC circuits, R-L-C, Active/reactive power, Three-phase circuits." },
      { title: "UNIT III: Transformers", content: "Single-phase transformer operation, emf, losses and efficiency." },
      { title: "UNIT IV: Rotating Machines", content: "DC motor, three phase induction motor and synchronous generator." },
      { title: "UNIT V: Basic Electronic Circuits", content: "Diode rectifier, Zener diode, Transistor as switch, Op-Amp characteristics." }
    ]
  },
  "EMA1119": {
    title: "Essentials of Information Technology",
    outcomes: ["Understand basic terminology.", "Differentiate system and application software."],
    units: [
      { title: "Unit I: Introduction", content: "Characteristics of computer, Evolution, Block Diagram, Classification." },
      { title: "Unit II: Raptor Tool", content: "Flowchart Interpreter, Symbols, Program Structure." },
      { title: "Unit III: Storage Fundamentals", content: "Primary vs Secondary Storage, RAM, ROM, PROM, EPROM." },
      { title: "Unit IV: Software", content: "S/W needs, Types: Operating System, Programming Languages (Machine, Assembly, High Level)." },
      { title: "Unit V: Operating System", content: "Batch Processing, Multiprogramming, Multi-Tasking, Time Sharing." }
    ]
  },
  "EMA1120": {
    title: "Essentials of Cyber Security",
    outcomes: ["Identify various threats and attacks.", "Create strong passwords."],
    units: [
      { title: "Unit I: Introduction", content: "Cybersecurity domains, Threats and Attack, vulnerabilities, Metasploit tool." },
      { title: "Unit II: Cyber Threats", content: "Malware, phishing, ransomware, social engineering, SEToolKit." },
      { title: "Unit III: Security Management", content: "CIA Triad, Wireshark, Defense-in-depth, Cybersecurity Controls." },
      { title: "Unit IV: Password Management", content: "Strong passwords, managers, John the Ripper password cracker." },
      { title: "Unit V: Network Security", content: "Configuration of routers/switches/firewalls, Palo Alto, Aircrack-ng." }
    ]
  },
  "EMA1207": {
    title: "Linux Programming",
    outcomes: ["Perform various commands.", "Execute user management and security commands."],
    units: [
      { title: "UNIT I: Introduction", content: "Windows vs Linux, Creation of Files and Folders, Hard/Soft Links." },
      { title: "UNIT II: Components", content: "Linux File System Hierarchy, Flavors, Basic Commands, I/O commands." },
      { title: "UNIT III: User Management", content: "Networking Commands, File Permissions and Security, Access Control List (ACL)." },
      { title: "UNIT IV: Shell Scripts", content: "Writing Shell Scripts, Conditional Statements, Control Statements." },
      { title: "UNIT V: Job Scheduling", content: "Cron, Package Management (Yum & Rpm), CP/MV/Tar Commands." }
    ]
  },
  "EMA1206": {
    title: "Electrical Circuits",
    outcomes: ["Analyze basic electric circuits with AC/DC.", "Understand resonance in circuits."],
    units: [
      { title: "UNIT-I: Introduction to Electrical Circuits", content: "Voltage and current sources, Nodal/Mesh analysis, Behavior of passive elements." },
      { title: "UNIT-II: Magnetic circuits", content: "Faraday’s laws, self and mutual inductance, series/parallel magnetic circuits." },
      { title: "UNIT-III: Single Phase AC Circuits", content: "RMS, average values, form factor, complex power, R-L-C state analysis." },
      { title: "UNIT-IV: Locus diagram and Resonance", content: "Series R-L/R-C/R-L-C variation, bandwidth and Q-factor." },
      { title: "UNIT-V: Network Theorems", content: "Reciprocity, Max Power Transfer, Norton’s, Millman’s Theorems." }
    ]
  },
  "EMA1105": {
    title: "Engineering Mechanics",
    outcomes: ["Solve resultant of forces.", "Calculate centroid and center of gravity."],
    units: [
      { title: "UNIT I: Introduction", content: "Basic terminology, Resultant of System of Forces (Coplanar Concurrent/Non-Concurrent)." },
      { title: "UNIT II: Equilibrium of System of Forces", content: "Free body diagrams, Lame’s Theorem, Equilibrium of Coplanar forces." },
      { title: "UNIT III: Friction", content: "Basic concepts, Laws of Friction, Static and Dynamic Friction, Ladder Friction." },
      { title: "UNIT IV: Centroid and Centre of Gravity", content: "Centroids of simple and composite figures, Pappus theorem." },
      { title: "UNIT V: Area Moment of Inertia", content: "Polar Moment of Inertia, Theorems of Moment of Inertia, Product of Inertia." }
    ]
  },
  "EMA1223": {
    title: "Electronic Components and Instruments",
    outcomes: ["Understand various Electronic Components.", "Understand test equipment (CRO)."],
    units: [
      { title: "UNIT I: Passive Electronic Components", content: "R, L, C Components (Color Codes), Potentiometers, Switches, Coils." },
      { title: "UNIT II: Active Electronic Components", content: "Diodes, BJT, JFET, MOSFET, Power Transistors, LED, Arduinos, UJT." },
      { title: "UNIT III: Measuring Instruments", content: "Measurement of Voltage (DC/AC), frequency, phase angle, pulse parameters." },
      { title: "UNIT IV: Working Principle of CRO", content: "CRO procedure for measurement, Lissajous figures." },
      { title: "UNIT V: Applications of CRO", content: "Real-world testing and behavior characterization of circuits." }
    ]
  },
  "ESE1222": {
    title: "Engineering Graphics",
    outcomes: ["Appreciate engineering curves.", "Construct isometric views."],
    units: [
      { title: "SHEET I & II", content: "AutoCAD intro, Ellipse, Parabola, Hyperbola, Cycloid, Epi-Cycloid, Hypo-Cycloid." },
      { title: "SHEET III & IV", content: "Projection of Lines and Planes (Inclined to VP & HP)." },
      { title: "SHEET V & VI", content: "Projection and Section of Solids (Prism, pyramid, cone, cylinder)." },
      { title: "SHEET VII & VIII", content: "Development of Solids, Isometric View of simple and compound solids." },
      { title: "SHEET IX & X", content: "Conversion of Isometric to Orthographic views and vice versa." }
    ]
  },
  "EAE1X23": {
    title: "Effective Communication Skills",
    outcomes: ["Exhibit clarity in verbal communication.", "Equip essential communication skills."],
    units: [
      { title: "Exercise-I: Conversations", content: "Ice-Breaking, Self-Introduction, Elevator speech, JAM sessions." },
      { title: "Exercise-II: Contexts", content: "Role-Plays: Voice modulation, Pitch, Tone, Seeking Advice, Suggestions." },
      { title: "Exercise-III: Articulation", content: "Giving Directions, Phone Etiquette, Ideate and share." },
      { title: "Exercise-IV: Oratory Skills", content: "Presentation Skills: Formal Individual & Group Presentations." },
      { title: "Exercise-V: Structured Talks", content: "Extempore speeches & Debates." }
    ]
  },
  "EAE1X02": {
    title: "Empowering with English Language Skills",
    outcomes: ["Recognize language applied to society.", "Compose different kinds of writing."],
    units: [
      { title: "Unit 1: Human Values", content: "Synonyms/Antonyms, Grammar, Sentence structure, 'The Gift of Magi'." },
      { title: "Unit 2: Science & Technology", content: "Homonyms, Cohesive Devices, Paragraph writing features." },
      { title: "Unit 3: Biography", content: "Elon Musk - Grammar: Verbs & Tenses, Conditionals, Essays." },
      { title: "Unit 4: Inspiration", content: "The Joy of Peace, Active/Passing Voice, Letter-writing." },
      { title: "Unit 5: Motivation", content: "Intrapersonal Communication, Technical jargon, Report-Writing." }
    ]
  },
  "EVA1121": {
    title: "Joy of Engineering - I",
    outcomes: ["Critically observe phenomena.", "Record observations in chronicles."],
    units: [
      { title: "Module 1: Breaking Initiative", content: "Open up / disintegrate any tangible thing to explore components." },
      { title: "Module 2: Making Initiative", content: "Assemble / integrate any tangible thing for optimal performance." },
      { title: "Module 3: Additive Manufacturing", content: "3D printing / scanning, models, materials and processes." },
      { title: "Module 4: Social Immersion", content: "Social and environmental aspects of technology adaptation." },
      { title: "Module 5: Design thinking", content: "Ideation, steps, entrepreneurial thinking, business models." }
    ]
  },
  "EVA1221": {
    title: "Joy of Engineering - II",
    outcomes: ["Critically experience phenomena.", "Devise alternate methods for tasks."],
    units: [
      { title: "Module 1: Breaking Initiative", content: "Analysing components/ingredients of tangible things critically." },
      { title: "Module 2: Making Initiative", content: "Reviewing how things/tasks can be performed in alternate ways." },
      { title: "Module 3: Additive Manufacturing", content: "Evaluate 3D printing and scanning for job works." },
      { title: "Module 4: Social Immersion", content: "Experience problems faced by other social groups and suggest solutions." },
      { title: "Module 5: Design thinking", content: "Design thinking steps to make imaginary/tangible products." }
    ]
  },
  "ESE1125": {
    title: "Data Analytics Practices",
    outcomes: ["Proficiency in Excel Tools.", "Data Cleaning and Preprocessing."],
    units: [
      { title: "Week 1-3: Intro & Summary", content: "Excel Basics, Search, Formatting, Basic Operators, SUM, MIN, MAX, AVERAGE." },
      { title: "Week 4-7: Data Handling", content: "Vlookup, Hlookup, Index, Match, Nested IF, Data Import, Handling missing values." },
      { title: "Week 8-10: Visualization", content: "Mean/Median/Mode, Histograms, Box plots, Scatter plots, Bar/Pie charts." },
      { title: "Week 11-13: Pivot Tables", content: "Introduction to Pivot Tables, Slicers, Timelines, Formatting, Advanced Techniques." },
      { title: "Week 14-15: Dashboards", content: "Designing interactive dashboards, Review." }
    ]
  }
};
