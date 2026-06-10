
export interface Subject {
  code: string;
  title: string;
  credits: number;
  type: string; // BS, ES, HS, PC etc.
  lecture?: number;
  tutorial?: number;
  practical?: number;
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
  "Artificial Intelligence & Machine Learning",
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
  "Artificial Intelligence & Machine Learning": {
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
    ],
    3: [
      { code: "EMA2101", title: "Computer Organization", credits: 3, type: "PC" },
      { code: "EMA2X02", title: "Discrete Mathematics", credits: 3, type: "ES" },
      { code: "EMD2X01", title: "Computer Oriented Statistical Methods", credits: 3, type: "BS" },
      { code: "EMA2103", title: "Data Structures and Algorithms", credits: 5, type: "PC" },
      { code: "EMA2104", title: "Object Oriented Programming through Java", credits: 5, type: "PC" },
      { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" },
    ],
    4: [
      { code: "EMA2201", title: "Operating Systems", credits: 3, type: "PC" },
      { code: "EMA2202", title: "Design and Analysis of Algorithms", credits: 3, type: "PC" },
      { code: "EMA2X03", title: "Software Engineering", credits: 3, type: "PC" },
      { code: "EMA2204", title: "Database Systems", credits: 4, type: "PC" },
      { code: "EMA2205", title: "Advanced Java Programming", credits: 4, type: "PC" },
      { code: "EAE2221", title: "English through Theatre Arts", credits: 2, type: "HS" },
      { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" },
      { code: "INT2201", title: "Summer Internship / Certification", credits: 0, type: "IN" },
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
      { code: "EMI1X04", title: "Basic Electrical and Electronics Engineering", credits: 3, type: "ES" },
      { code: "EMA1102", title: "Programming in C", credits: 4, type: "ES" },
      { code: "EVA1121", title: "Joy of Engineering - I", credits: 3, type: "ES" },
      { code: "EMA1101", title: "Engineering Mechanics - I", credits: 2, type: "PC" },
    ],
    2: [
      { code: "EMI1202", title: "Ordinary Differential Equations and Vector Calculus", credits: 4, type: "BS" },
      { code: "EMD1X07", title: "Engineering Physics", credits: 4, type: "BS" },
      { code: "EMA1204", title: "Data Structures", credits: 4, type: "ES" },
      { code: "EAE1X02", title: "Empowering with English Language Skills", credits: 3, type: "HS" },
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
  "EMA1201": {
    title: "Engineering Mechanics - II",
    outcomes: [
      "Explain structural kinetics and particle kinematics.",
      "Calculate mass moment of inertia of bodies.",
      "Evaluate virtual work in systems of connected bodies."
    ],
    units: [
      { title: "UNIT I: Kinematics of Particles", content: "Rectilinear motion, Curvilinear motion, Projectile motion, relative motion." },
      { title: "UNIT II: Kinetics of Particles", content: "Newton's laws of motion, Work-Energy principle, Impulse-Momentum theorem, impact of elastic bodies." },
      { title: "UNIT III: Kinematics of Rigid Bodies", content: "Translation, rotation about a fixed axis, absolute and relative general plane motion." },
      { title: "UNIT IV: Kinetics of Rigid Bodies", content: "Force and acceleration, Work-Energy of rigid bodies, angular momentum." },
      { title: "UNIT V: Work & Virtual Work", content: "Principles of Virtual work, potential energy and stability of equilibrium of systems." }
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
  "EMI1206": {
    title: "Statistical foundations for Data Science",
    outcomes: [
      "Understand and analyze discrete and continuous probability distributions.",
      "Apply sampling theory and point estimation to dataset properties.",
      "Perform hypothesis testing for means, proportions and variances."
    ],
    units: [
      { title: "UNIT I: Introductory Probability", content: "Probability spaces, conditional probability, Bayes' Theorem, Random variables and expectation." },
      { title: "UNIT II: Probability Distributions", content: "Binomial, Poisson, Unified distribution, Exponential, and Normal distributions." },
      { title: "UNIT III: Sampling and Estimation", content: "Sampling distribution of mean and variance, Central Limit Theorem, confidence intervals, maximum likelihood estimation." },
      { title: "UNIT IV: Hypothesis Testing", content: "Z-tests, T-tests, F-tests, Chi-Square goodness of fit tests, ANOVA basics." },
      { title: "UNIT V: Correlation and Linear Regression", content: "Bivariate distributions, Pearson correlation coefficient, simple linear regression, least-squares estimation." }
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
  },
  "EMA1224": {
    title: "Introduction to Generative AI",
    outcomes: [
      "Identify problems applicable to AI models.",
      "Understand and utilize various text and image generation AI tools.",
      "Apply appropriate Natural Language Processing (NLP) workflows.",
      "Understand the mechanics of text-to-image and text-to-text generation."
    ],
    units: [
      { title: "UNIT I: Story Generation & Digital Artwork (Weeks 1-3)", content: "Create stories and poems from prompts written in specific author styles. Reimagine classic book covers. Build study guides from raw course materials and design digital art." },
      { title: "UNIT II: Summaries & Movie Scenes (Weeks 4-6)", content: "Summarize lengthy articles greenhouse. Design text-to-image prompts to render movie scenes. Execute multi-lingual translations and design animation characters." },
      { title: "UNIT III: Recipe Generator & Travel Planners (Weeks 7-9)", content: "Formulate custom recipes from ingredients in real-time. Design visually rich travel itineraries and custom jewelry using AI. Design personalized budget sheets and 3D architectural displays." },
      { title: "UNIT IV: Audio Composition & Wearable Integration (Weeks 10-12)", content: "Compose basic musical structures including lyrics, piano, and guitar tabs. Integrate technology into fashion design. Build detailed garden layouts and remote space exploration visualizations." },
      { title: "UNIT V: Slides Design & Reconstructions (Weeks 13-14)", content: "Create professional presentation slides using AI tools. Develop highly accurate visual and narrative archeological site reconstructions. Review core GenAI parameters and guidelines." }
    ]
  },
  "EMI1X24": {
    title: "Emerging Technologies (MOOCs)",
    outcomes: [
      "Understand fundamental concepts of Prompt Engineering.",
      "Master cloud service models and cloud resource structures.",
      "Understand practical Python and R workflows in Data Science.",
      "Contrast classical and Generative AI paradigms.",
      "Learn nanosatellite orbits and telemetry."
    ],
    units: [
      { title: "UNIT I: Prompt Engineering for Everyone", content: "Introduction to prompt engineering. Naive prompting vs Chain-of-Thought approach. Learn Persona Pattern, Interview Pattern, controlling verbosity, and IBM Watsonx Prompt Lab." },
      { title: "UNIT II: Introduction to Cloud", content: "Essential characteristics of cloud. Cloud providers, service models (IaaS, PaaS, SaaS), deployment, virtualization, VMs, containers, block/object storage, and serverless architectures." },
      { title: "UNIT III: Data Science Foundations", content: "Defining Data Science, career roadmaps, cloud data environments, R vs Python, regression analysis, data scientist tools, and business presentation of final deliverables." },
      { title: "UNIT IV: Introducing AI & Machine Learning", content: "Artificial Intelligence overview, impact of AI, classic neural networks, applications, and famous IBM Watson Watsonx systems." },
      { title: "UNIT V: Nanosatellites & Orbit Mechanics", content: "Introduction to nanosatellite systems, orbital dynamics, telemetry tracking, communication protocols, propulsion options, and mission planning." }
    ]
  },
  "EVA1222": {
    title: "Problem Solving using Global Coding Platform",
    outcomes: [
      "Utilize major online platforms like LeetCode, HackerRank, and CodeChef.",
      "Formulate C programs to solve operators and conditional challenges.",
      "Optimize prime and numerical factorization loops.",
      "Manipulate multi-dimensional grid structures like Sudoku matrices.",
      "Validate complex character patterns and string formats."
    ],
    units: [
      { title: "UNIT I: Introduction & Operators (Weeks 1-2)", content: "Introduction to online platforms and registration workflows. Solve discount selectors, determine smallest/largest of three numbers, and configure room temperature solvers." },
      { title: "UNIT II: Loops & Character Checking (Weeks 3-5)", content: "Prime and palindrome access codes, unique prime factors, secret code decryptors, digit categorization, and triangular number series." },
      { title: "UNIT III: One-Dimensional Arrays (Weeks 6-8)", content: "Handling gem set duplicates safely, pancake swap sorting models, exhibition paintings display routes, and finding proximity weights ('Shadow of the Greatest')." },
      { title: "UNIT IV: Multi-Dimensional Arrays & Game of Life (Weeks 9-11)", content: "Validate 9x9 Sudoku grids, execute 2D coordinate matrix multiplications, solve maze BFS/DFS pathfinders, and implement simulation states of Conway's Game of Life." },
      { title: "UNIT V: String Grids & Functional Modularization (Weeks 12-14)", content: "Crossword puzzle column/row validations, email domain unique maps, sentence constraints checks, Gregorian calendar leap-year calculators, and names alphabetical sorting." }
    ]
  },
  "EMA2101": {
    title: "Computer Organization",
    outcomes: [
      "Analyze Instructions and Instruction Sequencing.",
      "Examine how interrupts contribute to optimized and efficient I/O operations.",
      "Compare memory mapping techniques.",
      "Analyze the role of secondary storage in the memory hierarchy.",
      "Investigate how a hardwired control unit operates."
    ],
    units: [
      { title: "UNIT I: Basic Structure of Computers", content: "Computer types, Functional Units, Basic Operational Concepts, Bus Structures, and Software. Machine Instructions: Instructions and Instruction Sequencing: Register transfer notation, Assembly language notation, Basic instruction types, Instruction Execution and straight-line sequencing. Branching, Condition Codes. Generating Memory Address. Addressing Modes: Implementation of Variables and constants, Indirection and pointers, Indexing and Arrays, Relative Addressing, Additional Modes." },
      { title: "UNIT II: Input – Output Organization", content: "Accessing I/O Devices, Interrupts with examples, Interrupt Hardware, Enabling and disabling interrupts, Handling Multiple Devices, Controlling Device requests, Exceptions. Direct memory Access, Bus arbitration, Buses, Synchronous Bus, Asynchronous bus." },
      { title: "UNIT III: Memory System", content: "Basic Concepts, Semiconductor RAM memories, internal organization of memory chips. Static memory, Asynchronous DRAM, Synchronous DRAM, Structure of larger Memories. Memory System Consideration, Rambus Memory. Read Only Memories and Memory Hierarchy. Cache Memory, Mapping Function (Direct, Associative and Set Associate Mapping). Replacement Algorithms. Example of mapping Techniques." },
      { title: "UNIT IV: Performance Considerations", content: "Performance Consideration, Interleaving, Hit Ratio and Miss Penalty, Cache on the Processor Chip, Other enhancements. Virtual Memories, Address Translation, Memory Management Requirements, Secondary Storage, Magnetic Hard Disks, Optical Disks, Magnetic Tape Systems." },
      { title: "UNIT V: Basic Processing Unit", content: "Register Transfer, Performing an Arithmetic or Logic operations, fetching a word from memory, storing a word in Memory. Execution of a complete Instruction, Branch Instructions. Multiple Bus Organization. Hardwired Control, A complete Processor, Microprogrammed Control, Microinstructions, Microprogram Sequencing, Wide-Branch addressing, Microinstruction with Next Address Field, Prefetching microinstructions, Emulation." }
    ]
  },
  "EMA2X02": {
    title: "Discrete Mathematics",
    outcomes: [
      "Distinguish between Statement Logic and Predicate Logic.",
      "Apply the principles of Permutations and Combinations.",
      "Solve Recurrence Relations by using generating functions.",
      "Apply the knowledge of Relations and Lattice theory.",
      "Analyze the Algebraic Systems with their properties."
    ],
    units: [
      { title: "UNIT I: Foundations", content: "Basics, Sets and Operations of Sets, Fundamentals of Logic, Logical Inferences, First order logic and other methods of Proof, Rules of Inference for Quantified Propositions." },
      { title: "UNIT II: Elementary Combinatorics", content: "Basics of Counting, Combinations and Permutations, Enumerating Combinations and Permutations with & without repetitions, constrained repetitions, and Principle of Inclusion and Exclusion." },
      { title: "UNIT III: Recurrence Relations", content: "Generating Functions, calculating coefficient of Generating Function, Solving Recurrence relations by substitution method and Generating Functions, The Method of Characteristic Roots, Solutions to inhomogeneous recurrence relations." },
      { title: "UNIT IV: Relations and Lattices", content: "Relations, adjacency matrices and Directed Graphs, Operations on Relations, Special Properties of Binary Relations, Equivalence Relations, Ordering Relations, Lattices." },
      { title: "UNIT V: Algebraic structures", content: "Algebraic systems, examples and general properties, semi groups and monoids, groups, sub groups, homomorphism, isomorphism, Permutation Groups and cyclic permutations." }
    ]
  },
  "EMD2X01": {
    title: "Computer Oriented Statistical Methods",
    outcomes: [
      "Define and differentiate between moments, random variables.",
      "Calculate key measures such as mean, variance for Binomial, Poisson, Normal and Exponential distributions.",
      "Compute, interpret the Pearson, Spearman measures of correlation.",
      "Formulate statistical hypotheses and apply appropriate hypothesis testing methods.",
      "Understand applications of Queuing Theory in arrival and departure processes."
    ],
    units: [
      { title: "UNIT I: Moments & Random Variables", content: "Moments-Definition, Central and Non-Central, Skewness, Kurtosis (Based on Moments only). Random Variables: Definition of random variable, discrete and continuous random variables, probability mass function and probability density function with applications. Mathematical Expectation: Definition of expectation, Variance, covariance and their properties with applications. Definition and properties of moment generating function." },
      { title: "UNIT II: Probability Distributions", content: "Definitions, Derivation of mean and variance of Binomial, Poisson, Normal and Exponential Distributions and their applications." },
      { title: "UNIT III: Correlation, Regression & Hypothesis Testing", content: "Bivariate data, Concept of correlation, computation of Karl-Pearson correlation coefficient. Spearman’s rank correlation coefficient. Simple linear regression, correlation verses regression, lines of regression and properties of regression coefficients. Testing of Hypothesis: Null and Alternative hypothesis, Critical region, two types of errors, Level of significance. One and two tailed tests. Procedure for testing of hypothesis. Large Samples: Tests for single sample mean, Difference of means, single sample proportion, Difference of proportions." },
      { title: "UNIT IV: Small Samples", content: "Degrees of freedom, Tests of significance based on student’s t-test for single sample specified mean, difference of means for independent and Paired t-test. Chi-Square test for Goodness of fit and Independence of attributes. F - test for equality of population variances. ANOVA-One way." },
      { title: "UNIT V: Queuing Theory", content: "Introduction-Queuing system-The arrival pattern-The service pattern-The queue discipline, Symbolic Representation of a Queuing Model –Characteristics of Infinite Capacity, Single server Poisson Queue Model, Queuing Problem-Pure Birth and Death Process-Probability Distribution of Departures (pure death process)- Basic Queuing Models-Measures of the (M/M/1) : (infinity/FIFO) model- Characteristic of Finite Capacity." }
    ]
  },
  "EMA2103": {
    title: "Data Structures and Algorithms",
    outcomes: [
      "Implement tree traversal algorithms.",
      "Apply principles of Binary Search Trees in solving complex problems.",
      "Analyze various operations on Advanced Trees.",
      "Interpret the importance of Graphs in solving real time applications.",
      "Apply the concepts of hashing."
    ],
    units: [
      { title: "UNIT I: Applications of Stack & Trees", content: "Applications of Stack - Reversing a list, Parenthesis checker, conversion of an infix expression to postfix expression and prefix expression, Recursion, Towers of Hanoi. Trees: Basic terminology, Types of Trees: General Trees, Binary Trees, Complete Binary Tree, Extended Binary Trees, Representation of Binary Trees in the Memory-Using Arrays and Linked lists (advantages and disadvantages) Traversing a Binary Tree, Constructing a Binary Tree from Traversals." },
      { title: "UNIT II: Threaded Trees & Heaps", content: "Threaded Binary Trees - One-way Threading, Two-way Threading, Representation of Algebraic Expressions and its implementation. Binary Search Trees: Operations on BST - searching, insertion, and deletion in BST. Heaps: Introduction, Types of Heaps – Min binary heap, Max binary heap." },
      { title: "UNIT III: Multi-Way Trees & Balanced Trees", content: "AVL Trees: Operations on AVL Trees- searching, insertion, deletion and rotation. Red-Black Trees-Properties of Red Black Trees and Splay Trees- Operations on splay trees. B-Trees: Searching, Insertion and deleting in B-trees." },
      { title: "UNIT IV: Graphs & Minimum Spanning Trees", content: "Graphs: Definition, Graph Terminology, Representation of Graphs: Sequential and linked representation, Graph Traversal Algorithms -Breadth First Search, Depth First Search with algorithms and implementation. Spanning Trees: Definition and its properties, Minimum Spanning Tree, Exploring Minimum Spanning Tree Algorithms: Implementation of Prim’s and Kruskal’s. Implementation of Dijkstra Algorithms for finding shortest path in graphs." },
      { title: "UNIT V: Hashing & Collision Resolution", content: "Hashing: Introduction, Hash Tables, Hash Functions, Collisions: Collision resolution by Open Addressing-Linear probing, Quadratic Probing, Double Hashing, Collision resolution by Chaining. Additional concepts: Rehashing, Extendible Hashing and Implementation of Dictionaries." }
    ]
  },
  "EMA2104": {
    title: "Object Oriented Programming through Java",
    outcomes: [
      "Appraise the basic concepts of Java.",
      "Implement base and derived classes using inheritance.",
      "Design and develop custom exception classes.",
      "Implement user-defined packages to support code modularity.",
      "Apply synchronization to ensure thread safety in shared resources."
    ],
    units: [
      { title: "UNIT I: Introduction & Java Basics", content: "Introduction to OOPS & Java Basics: History of Java, OOP Principles, Java buzzwords, data types, variables, scope and lifetime of variables, arrays, operators, expressions, control statements, simple java program. (Basic concepts on operators, control statements may be conducted in line with regular programming exercises)" },
      { title: "UNIT II: Java Classes & Inheritance", content: "Classes & Methods: Concepts of classes, objects, constructors, methods, access control, this keyword, static keyword, Garbage collection, Overloading methods and constructors, parameter passing. Inheritance: Inheritance Basics-Member Access and Inheritance, A super class variable can reference a subclass object, types of inheritance, using super keyword, creating a Multilevel Hierarchy, using final with inheritance." },
      { title: "UNIT III: Polymorphism & Exception Handling", content: "Polymorphism: Method Overriding, Dynamic Method Dispatch, Abstract classes, Object class. Exception Handling: Concepts of exception handling, exception hierarchy, usage of try, catch, throw, throws and finally, built-in exceptions, creating own exception subclasses." },
      { title: "UNIT IV: Packages & Interfaces", content: "Packages and Interfaces: Defining a package, Access Protection-An Access Example, Importing packages, Interfaces-Implementing interfaces, Nested Interfaces, differences between classes and interfaces, File, Byte Streams, Character Streams." },
      { title: "UNIT V: Multi-Threading & Inter-Thread Communication", content: "Multi-Threading: Differences between multithreading and multitasking, thread life cycle, creating threads, thread priorities, synchronizing threads, inter thread communication." }
    ]
  },
  "EVA2101": {
    title: "Integrated Project - I",
    outcomes: [
      "Identify real-world social or environmental problems.",
      "Formulate and develop tech-based solutions.",
      "Document, report phase progress, and present slides."
    ],
    units: [
      { title: "UNIT I: Phase I (Weeks 1-7)", content: "Problem Identification, Literature Survey, formulation of the visual database structure, solution architecture overview, and intermediate system evaluation." },
      { title: "UNIT II: Phase II (Weeks 8-14)", content: "Implementation of primary components, experimental validation checks, final dissertation compilation, and technical jury demonstration review." }
    ]
  },
  "EMA2201": {
    title: "Operating Systems",
    outcomes: [
      "Summarize operating systems concepts and structures.",
      "Apply process scheduling algorithms.",
      "Outline process synchronization and deadlock handling mechanisms.",
      "Analyze effectively memory management concepts.",
      "Illustrate file system, various protection and security measures."
    ],
    units: [
      { title: "UNIT I: OS Overview & Structures", content: "Operating Systems Overview: What operating systems do, Operating System operations, computing environment. Operating Systems Structures: Operating system services, User Operating-System Interface, System calls, Types of System calls, Operating System structure." },
      { title: "UNIT II: Process Management & CPU Scheduling", content: "Process Management: Overview, Process scheduling, Operations on processes, Inter process communication. Threads: overview, Multithreading models. Process Scheduling: Basic concepts, Scheduling criteria, CPU Scheduling." },
      { title: "UNIT III: Process Synchronization & Deadlocks", content: "Process Synchronization: Background, The critical section problem, Peterson’s solution, Synchronization hardware, Semaphore, Classical problems of synchronization, Monitors. Deadlocks: System model, Deadlock characterization, Methods for handling deadlocks, Deadlock prevention, avoidance, detection, recovery from deadlock." },
      { title: "UNIT IV: Memory Management & Virtual Memory", content: "Memory Management: Background, Swapping, Contiguous memory allocation, Paging, Segmentation. Virtual Memory Management: Background, Demand paging, Copy-on-write, Page-Replacement, Thrashing." },
      { title: "UNIT V: File Systems & Security", content: "File System: File concept, Access methods, Directory structure, File-system mounting, Allocation methods, Disk structure, Disk scheduling. Protection: Goals of protection, Principles of protection, Domain of protection, Access matrix, Access Control. Security: The Security problem, Program threats, System and Network threats." }
    ]
  },
  "EMA2202": {
    title: "Design and Analysis of Algorithms",
    outcomes: [
      "Appreciate divide and conquer paradigm.",
      "Design greedy paradigm for a given problem.",
      "Apply dynamic-programming technique for a given scenario.",
      "Design branch and bound paradigm for real time problems.",
      "Compare and contrast P and NP problems with examples."
    ],
    units: [
      { title: "UNIT I: Complexity, Divide & Conquer", content: "Introduction: Algorithm, Pseudo code for expressing algorithms, Performance Analysis-Space complexity, Time complexity, Asymptotic Notation- Big oh notation, Omega notation, Theta notation and Little oh notation, Disjoint Sets- disjoint set operations, union and find operations. Divide and conquer: General method, applications-Binary search, Quick sort, Merge sort." },
      { title: "UNIT II: Graph Search & Greedy Method", content: "Graphs: breadth first search, depth first search, spanning trees, connected and bi connected components. Greedy Method: General method, applications-Job sequencing with deadlines, 0/1 knapsack problem, Minimum cost spanning trees, Single source shortest path problem." },
      { title: "UNIT III: Dynamic Programming", content: "Dynamic Programming: General method, Multistage graph, applications-Matrix chain multiplication, Optimal binary search trees, 0/1 knapsack problem, All pairs shortest path problem, Travelling salesperson problem." },
      { title: "UNIT IV: Backtracking & Branch and Bound", content: "Backtracking: General method, applications-n-queen problem, sum of subsets problem, graph coloring, Hamiltonian cycles. Branch and Bound: General method, applications -Travelling salesperson problem, 0/1 knapsack problem- LC Branch and Bound solution, FIFO Branch and Bound solution." },
      { title: "UNIT V: Lower Bound Theory & NP Problems", content: "Lower Bound Theory: Comparison trees, NP-Hard and NP-Complete problems: Basic concepts, non-deterministic algorithms, NP - Hard and NP Complete classes, Clique Decision Problem (CDP), Node cover decision problem." }
    ]
  },
  "EMA2X03": {
    title: "Software Engineering",
    outcomes: [
      "Compare software development models.",
      "Demonstrate software requirements by using Software Requirements Specification.",
      "Analyze the computational designs.",
      "Design user interfaces using golden rules.",
      "Estimate software effort using structured techniques and cost models."
    ],
    units: [
      { title: "UNIT I: Software process models", content: "The Nature of Software: The Nature of software, The Changing Nature of software. Software engineering: Defining the discipline, the software process, software engineering practice, Software Development myths, how it all Starts. Software Process Structure: A Generic Process Model, Defining Framework Activity, Process Assessment and Improvement. Process models: Prescriptive Process Models - The waterfall model, Incremental process models, Evolutionary Process model, Evolutionary Process Models, Spiral Model, Concurrent Models." },
      { title: "UNIT II: Agile & Requirements Engineering", content: "Agile Development: What is Agility? Agility and the cost of change, what is an Agile Process? Extreme Programming, Other Agile Process Models, A tool set for the Agile process. Case Study - Selecting a Process Model Safe Home Part-1 and Part-2. Requirements Engineering: Functional and non-functional requirements, Requirement Engineering Process Requirements elicitation, Requirement specification, Requirement validation, Requirement Change." },
      { title: "UNIT III: System Design Concepts", content: "Design Concepts: The Design Process, Design concepts, The design model. Modeling Level Design: What is a component? Design class-based components, conducting component level design, Computational level design for Web Apps, Computational level design for Mobile Apps." },
      { title: "UNIT IV: User Interface Design & Testing", content: "User Interface Design: Golden rules, User Interface Analysis and Design. Software Testing Strategies: A strategic approach to software testing, Strategic issues, Test strategies for conventional software. Testing Conventional Applications: Software Testing Fundamentals, Internal and External Views of Testing, White-Box Testing, Basis Path Testing, Control Structure Testing, Black-Box Testing." },
      { title: "UNIT V: Estimation & Project Scheduling", content: "Estimation for Software Projects: Observations on Estimation, The Project Planning Process, Software Scope and Feasibility, Resources, Software Project Estimation, Decomposition Techniques, Empirical Estimation Models, Estimation for Object Oriented Projects, Specialized estimation Techniques, The Make/Buy Decision." }
    ]
  },
  "EMA2204": {
    title: "Database Systems",
    outcomes: [
      "Model Entity-Relationship diagrams for enterprise level databases.",
      "Formulate Queries using SQL and Relational Formal Query Languages.",
      "Develop proficiency in intermediate and advanced SQL.",
      "Apply relational database design principles to normalize given database.",
      "Implement concurrency control protocols and recovery algorithms to maintain Consistency of database."
    ],
    units: [
      { title: "UNIT I: Introduction & ER Modeling", content: "Introduction to Database System Concepts: Database-System Applications, Purpose of Database Systems, View of Data, Database Languages, Database Architecture, Database Users and Administrators. Introduction to the Relation Models and Database Design using ER Model: Structure of Relational Databases, Database Schema, Keys. Overview of the Design Process, The Entity-Relationship Model, Constraints, Removing Redundant Attributes in Entity Sets. Entity-Relationship diagrams." },
      { title: "UNIT II: Relational Algebra & SQL Basics", content: "Formal Relational Query Languages: The relational algebra, Tuple Relational Calculus. Introduction to SQL: Overview of the SQL Query Language, SQL Data Definition, Basic Structure of SQL Queries, Additional Basic Operations, Set Operations, Null Values, Aggregate Functions, Nested Sub queries. Modification of Database." },
      { title: "UNIT III: Intermediate & Advanced SQL", content: "Intermediate SQL: Join Expressions, Views, Transactions, Integrity Constraints, SQL Data Types and Schemas, Authorization. Advanced SQL: Functions and Procedures, Triggers, Recursive Queries, Advanced Aggregate Functions." },
      { title: "UNIT IV: Normalization & Transaction isolation", content: "Relational Database Design: Features of Good Relational Designs, Atomic Domains and First Normal Form, Functional Dependency Theory, Closure set of Functional dependencies, second Normal Form, Third Normal Form, Boyce Codd Normal form. Transactions: Transaction Concept, Simple Transaction Model, Transaction Isolation, ACID Properties, Serializability." },
      { title: "UNIT V: Concurrency Control & Recovery System", content: "Concurrency Control: Lock-Based Protocols, Deadlock Handling, Multiple Granularity, Timestamp-Based Protocols, Validation-Based Protocols. Recovery System: Failure Classification, Storage, Recovery and Atomicity, Recovery Algorithm - ARIES." }
    ]
  },
  "EMA2205": {
    title: "Advanced Java Programming",
    outcomes: [
      "Implement delegation event model in GUI-based applications.",
      "Develop Graphical User Interface application through Swings.",
      "Establish database connections using JDBC.",
      "Develop client-server application through Java Servlet API.",
      "Design and develop web applications using JSP."
    ],
    units: [
      { title: "UNIT I: Collections & Event Handling", content: "Package java.util: The Collection Interfaces, The Collection classes: LinkedList Class, HashSet Class. TreeSet Class, String Tokenizer, Date, Random, Scanner. Event Handling: Events, Event sources, Event classes, Event Listeners, Delegation event model, handling mouse and keyboard events, Adapter classes." },
      { title: "UNIT II: Swing Architecture & Layout Managers", content: "GUI Programming with Swing: Introduction, limitations of AWT, MVC architecture, components, containers. Understanding Layout Managers-Flow Layout, Border Layout, Grid Layout, Card Layout, Gridbaglayout." },
      { title: "UNIT III: Advanced Swings", content: "Exploring Swing: Creating a Swing Application, Painting in Swing, JLabel, JTextField, JButton, JCheckBox, JRadioButton, JScrollPane, JTabbedPane JList, JComboBox." },
      { title: "UNIT IV: JDBC & Servlets", content: "JDBC: JDBC Basics, Different types of JDBC Drivers, Establishing Connection, Executing Statements using Tables, Retrieving Values from Result Sets, Creating a simple application, Using Prepared Statement, Callable Statements. Servlets: Overview of Servlets, Architecture of the servlet package, A simple servlet, The lifecycle of a servlet, Running Servlets, Handling GET and Post Requests, using Cookies, Session Tracking." },
      { title: "UNIT V: JSP Page Life Cycle", content: "JSP: Introduction to JSP Technology, Understanding the Page Life Cycle, JSP Documents, A Simple JSP Document, JSP Elements-Directives, Actions, Implicit Objects, Scripting Elements." }
    ]
  },
  "EAE2221": {
    title: "English through Theatre Arts",
    outcomes: [
      "Communicate Effectively in English.",
      "Demonstrate improved fluency and accuracy in spoken and written English.",
      "Develop clearer and more expressive speech patterns.",
      "Analyze and perform scenes from various English-language plays.",
      "Collaborate creatively to perform."
    ],
    units: [
      { title: "UNIT I: Introduction to Drama", content: "Focus: Introduction to Drama, Types of Drama, Components of Drama, Monologue, Soliloquy, Dramatic Monologue, Drama Vocabulary." },
      { title: "UNIT II: Voice & Intonation", content: "Art of Articulation: Expressing Emotion through Voice, Stress and Intonation." },
      { title: "UNIT III: Script Writing", content: "Art of Writing: Stages of Script Writing, Tips to Write a Script, Script/ Story Writing." },
      { title: "UNIT IV: Stage Directions & Movement", content: "Stage Directions: Various sections of a stage, Action and Movement, Role-play of a Short Scene." },
      { title: "UNIT V: Performance & Soliloquy", content: "Creativity: Writing Short Scenes, Giving Dramatic Reading, performing a Play/Monologue/Soliloquy; from Script to Performance." }
    ]
  },
  "EVA2201": {
    title: "Integrated Project - II",
    outcomes: [
      "Expand on previous design elements.",
      "Build robust final prototypes.",
      "Prepare standard documentation and technical defense checks."
    ],
    units: [
      { title: "UNIT I: Phase I (Weeks 1-7)", content: "Update previous documentation structures, configure system-level testing grids, and record mid-phase feedback checks." },
      { title: "UNIT II: Phase II (Weeks 8-14)", content: "Implement refined testing methodologies, compose complete dissertation, and defend in final university evaluation jury sessions." }
    ]
  },
  "INT2201": {
    title: "Summer Internship / Certification",
    outcomes: [
      "Gain hands-on exposure in industrial environments.",
      "Build active certifications using global proctored assessments."
    ],
    units: [
      { title: "UNIT I: Selection & Registration", content: "Construction of industry professional profile, select certifications registry (MOOCs - Swayam, NPTEL, Coursera), and submit enrollment forms." },
      { title: "UNIT II: Field practice or course tracking", content: "Engage in hands-on tasks, prepare professional training catalogs, present evaluations, and defend during the fifth-semester review panels." }
    ]
  }
};

export const SUBJECT_LTP: Record<string, { L: number; T: number; P: number }> = {
  "EMI1101": { L: 3, T: 1, P: 0 },
  "EMD1X06": { L: 3, T: 0, P: 2 },
  "EMI1X04": { L: 2, T: 0, P: 2 },
  "EMA1102": { L: 3, T: 0, P: 2 },
  "EAE1X23": { L: 0, T: 0, P: 2 },
  "EVA1121": { L: 0, T: 0, P: 6 },
  "ESE1125": { L: 0, T: 0, P: 2 },
  "EMI1201": { L: 3, T: 1, P: 0 },
  "EMD1X07": { L: 3, T: 0, P: 2 },
  "EMA1204": { L: 3, T: 0, P: 2 },
  "EAE1X02": { L: 2, T: 0, P: 2 },
  "EVA1221": { L: 0, T: 0, P: 6 },
  "EMA1224": { L: 1, T: 0, P: 2 },
  "EMI1X24": { L: 0, T: 2, P: 0 },
  "EMI1202": { L: 3, T: 1, P: 0 },
  "EVA1222": { L: 0, T: 1, P: 0 },
  "EMA1119": { L: 1, T: 0, P: 0 },
  "EMA1207": { L: 1, T: 0, P: 2 },
  "EMI1206": { L: 2, T: 0, P: 0 },
  "EMA1120": { L: 1, T: 0, P: 0 },
  "EMA1107": { L: 2, T: 0, P: 0 },
  "EMA1206": { L: 2, T: 0, P: 0 },
  "EMA1101": { L: 2, T: 0, P: 0 },
  "EMA1201": { L: 2, T: 0, P: 0 },
  "EMA1105": { L: 2, T: 0, P: 0 },
  "ESE1222": { L: 0, T: 0, P: 2 },
  "EMA1223": { L: 0, T: 1, P: 0 },
  "EMA2101": { L: 3, T: 0, P: 0 },
  "EMA2X02": { L: 3, T: 0, P: 0 },
  "EMD2X01": { L: 3, T: 0, P: 0 },
  "EMA2103": { L: 3, T: 0, P: 4 },
  "EMA2104": { L: 3, T: 0, P: 4 },
  "EVA2101": { L: 0, T: 0, P: 2 },
  "EMA2201": { L: 3, T: 0, P: 0 },
  "EMA2202": { L: 3, T: 0, P: 0 },
  "EMA2X03": { L: 3, T: 0, P: 0 },
  "EMA2204": { L: 3, T: 0, P: 2 },
  "EMA2205": { L: 2, T: 0, P: 4 },
  "EAE2221": { L: 1, T: 0, P: 2 },
  "EVA2201": { L: 0, T: 0, P: 2 },
  "INT2201": { L: 0, T: 0, P: 0 }
};
