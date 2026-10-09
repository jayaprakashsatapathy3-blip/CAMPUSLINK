"""Idempotently populate CAMPUSLINK with local demonstration data."""
import json
import random
from datetime import date, timedelta

from werkzeug.security import generate_password_hash

from app import (DEFAULT_BRANCHES, app, ensure_schema_compatibility, infer_quiz_question_topic,
                 learning_resource_url, sync_learning_resource_urls)
from models import (Application, Branch, Certificate, Company, Course, InterviewQuestion,
                    Job, JobSkill, NptelCertificate, Placement, Project, Quiz, QuizQuestion, Skill,
                    Student, StudentSkill, User, db, Internship)

random.seed(19)
BRANCHES = DEFAULT_BRANCHES
SKILLS = ["Python", "Java", "C", "C++", "SQL", "Data Structures", "Machine Learning", "Web Development", "Flask", "JavaScript", "HTML", "CSS", "Git", "Pandas", "NumPy", "Scikit-learn", "Power BI", "AWS", "Docker", "Communication", "Linux", "MySQL", "Statistics", "TensorFlow", "React", "Aptitude", "Excel", "MongoDB", "Cloud", "Problem Solving"]
COMPANIES = ["Northstar Systems", "BluePeak Analytics", "Orbit Software", "CedarWorks", "Vertex Mobility", "BrightPath Labs", "Aster Digital", "Nimbus Cloud", "Foundry Tech", "Pioneer Consulting"]
FIRST = ["Aarav", "Aditi", "Ananya", "Arjun", "Diya", "Ishaan", "Kabir", "Meera", "Neha", "Rohan", "Sana", "Vivaan", "Zoya", "Kiran", "Rahul", "Priya", "Dev", "Maya", "Nikhil", "Tara"]
LAST = ["Sharma", "Patel", "Rao", "Iyer", "Khan", "Mehta", "Das", "Nair", "Singh", "Kapoor"]

QUESTION_BANK = {
"Python": [
 ("Which Python type is immutable?", ["list", "dict", "tuple", "set"], 2),
 ("What does len([2, 4, 6]) return?", ["2", "3", "6", "12"], 1),
 ("Which keyword defines a function?", ["func", "def", "function", "lambda"], 1),
 ("What is the result of 7 // 2?", ["3", "3.5", "4", "1"], 0),
 ("Which structure stores key-value pairs?", ["tuple", "dict", "set", "str"], 1),
 ("What does list.append(x) do?", ["Adds x at the end", "Sorts the list", "Removes x", "Copies the list"], 0),
 ("Which block handles an exception?", ["catch", "except", "rescue", "error"], 1),
 ("What does range(3) produce?", ["0, 1, 2", "1, 2, 3", "0, 1, 2, 3", "3 only"], 0),
 ("Which operator checks equality?", ["=", "==", "===", "equals"], 1),
 ("How do you import a module named math?", ["include math", "using math", "import math", "require math"], 2),
],
"Java": [
 ("Which keyword creates a subclass?", ["implements", "extends", "inherits", "super"], 1),
 ("Which type stores true or false?", ["bool", "Boolean only", "boolean", "bit"], 2),
 ("Where does a Java program start?", ["start()", "main()", "run()", "init()"], 1),
 ("Which collection does not allow duplicate elements?", ["List", "Set", "Queue", "ArrayList"], 1),
 ("What does JVM stand for?", ["Java Variable Model", "Java Virtual Machine", "Joint Virtual Memory", "Java Verified Method"], 1),
 ("Which access level is most restrictive?", ["public", "protected", "private", "default"], 2),
 ("Which keyword prevents a class from being extended?", ["static", "final", "const", "sealed"], 1),
 ("What is the index of the first array element?", ["0", "1", "-1", "Depends on array"], 0),
 ("Which block runs whether or not an exception occurs?", ["try", "catch", "finally", "throw"], 2),
 ("What does an interface primarily define?", ["A contract of methods", "A database", "A running thread", "A package"], 0),
],
"C": [
 ("Which function prints formatted output?", ["write", "printf", "echo", "display"], 1),
 ("Which symbol ends most C statements?", [".", ":", ";", ","], 2),
 ("What is the typical size of char in C?", ["1 byte", "2 bytes", "4 bytes", "8 bytes"], 0),
 ("Which operator gets an address?", ["*", "&", "%", "#"], 1),
 ("Which header declares printf?", ["stdlib.h", "string.h", "stdio.h", "math.h"], 2),
 ("Which loop checks its condition before each iteration?", ["do-while", "while", "Both always run once", "goto"], 1),
 ("What does sizeof return?", ["Value of a variable", "Size in bytes", "Memory address", "Type name"], 1),
 ("Which is a valid C entry point signature?", ["int main(void)", "begin()", "void start()", "program()"], 0),
 ("What does a pointer hold?", ["A memory address", "A loop count", "Only a character", "A file name"], 0),
 ("Which function compares C strings?", ["strcpy", "strcmp", "strlen", "strcat"], 1),
],
"C++": [
 ("Which feature lets functions share a name with different parameters?", ["Overloading", "Overriding", "Casting", "Templating only"], 0),
 ("Which operator accesses a member through a pointer?", [".", "::", "->", "&"], 2),
 ("Which keyword allocates dynamic memory in C++?", ["malloc only", "new", "alloc", "create"], 1),
 ("What does a virtual function enable?", ["Runtime polymorphism", "Compile-time constants", "Memory cleanup", "File access"], 0),
 ("Which container stores unique ordered keys?", ["vector", "map", "list", "queue"], 1),
 ("What is the purpose of a destructor?", ["Initialize an object", "Clean up when an object is destroyed", "Copy an object", "Overload operators"], 1),
 ("Which header defines std::vector?", ["<array>", "<vector>", "<list>", "<memory>"], 1),
 ("What does const on a member function indicate?", ["It cannot modify object state", "It runs only once", "It is private", "It is static"], 0),
 ("Which cast is preferred for checked type conversions?", ["reinterpret_cast", "static_cast", "bit_cast only", "void cast"], 1),
 ("Which concept allows one class to derive from another?", ["Encapsulation", "Inheritance", "Iteration", "Compilation"], 1),
],
"SQL": [
 ("Which clause filters rows before grouping?", ["HAVING", "WHERE", "ORDER BY", "LIMIT"], 1),
 ("Which command retrieves rows?", ["FETCH", "SELECT", "READ", "OPEN"], 1),
 ("What does a primary key guarantee?", ["Unique row identity", "Sorted output", "No NULL in every column", "Encryption"], 0),
 ("Which join returns only matching rows?", ["LEFT JOIN", "FULL JOIN", "INNER JOIN", "CROSS JOIN"], 2),
 ("Which aggregate counts rows?", ["SUM", "AVG", "COUNT", "TOTAL"], 2),
 ("Which clause groups rows?", ["GROUP BY", "ORDER BY", "PARTITION", "MERGE"], 0),
 ("Which command changes existing rows?", ["ALTER", "UPDATE", "MODIFY TABLE", "CHANGE"], 1),
 ("What does COUNT(column) exclude?", ["Duplicate values", "NULL values", "Zero values", "Negative values"], 1),
 ("Which constraint links a value to another table?", ["CHECK", "DEFAULT", "FOREIGN KEY", "UNIQUE"], 2),
 ("Which clause filters aggregated groups?", ["WHERE", "HAVING", "GROUP", "FILTER"], 1),
],
"Data Structures": [
 ("Which structure follows LIFO?", ["Queue", "Stack", "Heap", "Graph"], 1),
 ("Which structure follows FIFO?", ["Stack", "Queue", "Tree", "Set"], 1),
 ("Average lookup in a hash table is typically?", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], 0),
 ("Which traversal visits left, root, right in a binary tree?", ["Preorder", "Inorder", "Postorder", "Level order"], 1),
 ("A binary search tree search is O(log n) when it is?", ["Balanced", "Stored on disk", "Complete only", "Empty"], 0),
 ("Which structure is best suited for priority-based removal?", ["Stack", "Heap", "Array", "Linked list"], 1),
 ("What is the time complexity of binary search?", ["O(n)", "O(log n)", "O(n²)", "O(1) always"], 1),
 ("Which data structure models vertices and edges?", ["Graph", "Stack", "Deque", "Hash map"], 0),
 ("What does a linked list node usually store?", ["Data and link(s)", "Only an index", "A sort order", "A table schema"], 0),
 ("Which traversal explores neighbors level by level?", ["DFS", "BFS", "Inorder", "Postorder"], 1),
],
"Machine Learning": [
 ("Which task predicts a continuous numeric value?", ["Classification", "Regression", "Clustering", "Ranking"], 1),
 ("What is overfitting?", ["Model performs well on training data but poorly on new data", "Model has no parameters", "Data is perfectly clean", "Training stops early"], 0),
 ("Which method evaluates generalization across data splits?", ["Cross-validation", "One hot encoding", "Imputation", "Tokenization"], 0),
 ("Which metric is TP/(TP+FP)?", ["Recall", "Precision", "Accuracy", "F1"], 1),
 ("What is an unsupervised learning example?", ["K-means clustering", "Linear regression with labels", "Spam classification", "Decision tree classification"], 0),
 ("Why scale features for distance-based models?", ["Prevent large-scale features dominating distance", "Remove labels", "Increase row count", "Avoid validation"], 0),
 ("What does regularization help reduce?", ["Overfitting", "Training data", "Feature names", "All bias"], 0),
 ("Which algorithm is an ensemble of decision trees?", ["Random Forest", "KNN", "Naive Bayes", "Linear regression"], 0),
 ("What is a feature?", ["An input variable used by a model", "A model output only", "A validation score", "A type of loss"], 0),
 ("Which split is commonly kept for final evaluation?", ["Test set", "Training set", "Feature set", "Prediction set"], 0),
],
"Web Development": [
 ("Which HTML element is intended for main page content?", ["<main>", "<span>", "<meta>", "<small>"], 0),
 ("What does CSS control?", ["Presentation and layout", "Database queries", "Server processes", "DNS records"], 0),
 ("Which JavaScript keyword declares a block-scoped variable?", ["var only", "let", "define", "dim"], 1),
 ("What does HTTP 404 mean?", ["Success", "Unauthorized", "Not found", "Server timeout"], 2),
 ("Which method sends data to create a resource?", ["GET", "POST", "HEAD", "OPTIONS"], 1),
 ("What is the DOM?", ["A programming interface for HTML documents", "A CSS framework", "A database engine", "A web protocol"], 0),
 ("Which CSS layout is one-dimensional?", ["Grid", "Flexbox", "Table", "Positioning"], 1),
 ("What does JSON represent?", ["A text data-interchange format", "An image format", "A query language", "A browser engine"], 0),
 ("Which attribute provides alternative text for an image?", ["title", "alt", "srcset", "role"], 1),
 ("What is a responsive layout designed to do?", ["Adapt to viewport sizes", "Require a desktop", "Disable CSS", "Cache API calls"], 0),
],
"Aptitude": [
 ("A product costs 800 and has a 10% discount. Sale price?", ["720", "700", "760", "780"], 0),
 ("Complete the sequence: 2, 4, 8, 16, ?", ["18", "24", "30", "32"], 3),
 ("If 5 workers finish a task in 6 days, how many worker-days is that?", ["11", "30", "6", "25"], 1),
 ("A car travels 120 km in 2 hours. Average speed?", ["40 km/h", "50 km/h", "60 km/h", "80 km/h"], 2),
 ("What is 25% of 240?", ["40", "50", "60", "80"], 2),
 ("If all roses are flowers, which statement must be true?", ["Every flower is a rose", "Some roses may be flowers", "No rose is a flower", "All plants are roses"], 1),
 ("Find the average of 4, 8 and 12.", ["6", "8", "10", "12"], 1),
 ("A ratio 2:3 has total 25. First share?", ["5", "10", "15", "20"], 1),
 ("What is the next prime after 11?", ["12", "13", "15", "17"], 1),
 ("A 20% increase on 50 gives?", ["55", "60", "65", "70"], 1),
],
}
BRANCH_QUESTION_BANK = {
"Digital Electronics": [
 ("An AND gate outputs 1 when:", ["Any input is 1", "All inputs are 1", "All inputs are 0", "Inputs differ"], 1),
 ("A 4-bit binary number 1010 equals decimal:", ["8", "9", "10", "12"], 2),
 ("An XOR gate outputs 1 when its two inputs are:", ["Both 0", "Both 1", "Different", "Always equal"], 2),
 ("A D flip-flop transfers D to Q on:", ["Its active clock edge", "Every reset", "A logic-low input only", "Power-off"], 0),
 ("The complement of A AND B is given by:", ["A OR B", "NOT A AND NOT B", "NOT A OR NOT B", "A XOR B"], 2),
 ("A 3-to-8 decoder has how many output lines?", ["3", "6", "8", "11"], 2),
 ("Which circuit selects one of many input lines?", ["Decoder", "Multiplexer", "Counter", "Comparator"], 1),
 ("A full adder adds:", ["One bit", "Two bits and a carry-in", "Two bytes", "A clock and a reset"], 1),
 ("A 4-bit unsigned binary counter has how many states?", ["4", "8", "16", "32"], 2),
],
"Embedded Systems": [
 ("A microcontroller typically integrates:", ["CPU, memory and peripherals", "Only a CPU", "Only external storage", "A monitor and keyboard"], 0),
 ("Which pair forms the I²C data and clock lines?", ["TX and RX", "SDA and SCL", "MOSI and MISO", "D+ and D−"], 1),
 ("UART communication is commonly:", ["Asynchronous serial", "Parallel video", "Optical-only", "A memory format"], 0),
 ("The volatile qualifier is useful for a value that:", ["May change outside normal program flow", "Must never change", "Is always constant", "Is stored only on disk"], 0),
 ("A watchdog timer is mainly used to:", ["Reset a stalled system", "Increase clock accuracy", "Store files", "Measure analog voltage"], 0),
 ("An ADC converts:", ["Digital data to analog", "Analog voltage to digital values", "Serial data to parallel only", "Temperature to current"], 1),
 ("SPI commonly uses which signal to select a device?", ["Chip select", "Ground select", "Parity select", "Address clock"], 0),
 ("A pull-up resistor helps an input pin:", ["Have a defined high level when undriven", "Run faster", "Store its firmware", "Generate an interrupt"], 0),
 ("An interrupt lets a processor:", ["Respond to an event without constant polling", "Avoid executing code", "Increase RAM size", "Disable every peripheral"], 0),
],
"Communication Systems": [
 ("In amplitude modulation, the carrier's ____ varies with the message.", ["Amplitude", "Frequency only", "Propagation speed", "Wavelength only"], 0),
 ("For a 3 kHz highest signal frequency, the Nyquist minimum sampling rate is:", ["1.5 kHz", "3 kHz", "6 kHz", "9 kHz"], 2),
 ("SNR compares signal power with:", ["Noise power", "Carrier frequency", "Bandwidth only", "Antenna height"], 0),
 ("Frequency modulation varies the carrier's:", ["Amplitude", "Frequency", "Phase only", "Speed of light"], 1),
 ("A low-pass filter passes frequencies:", ["Below its cutoff", "Above its cutoff only", "At exactly zero only", "In random order"], 0),
 ("The unit of signal bandwidth is:", ["Ohm", "Hertz", "Watt-hour", "Weber"], 1),
 ("Digital data is commonly represented using:", ["Discrete symbols", "Only a continuous voltage curve", "Mechanical motion", "Acoustic pressure only"], 0),
 ("A repeater in a communication link is used to:", ["Regenerate or strengthen a weakened signal", "Encrypt every message", "Change a receiver into a transmitter", "Set the sampling theorem"], 0),
 ("Antenna gain is commonly expressed in:", ["dBi or dBd", "Farads", "Baud only", "Kelvin"], 0),
],
"Electrical Machines": [
 ("A transformer transfers AC power mainly by:", ["Electromagnetic induction", "Chemical reaction", "Friction", "Electrolysis"], 0),
 ("The synchronous speed of an AC machine depends on frequency and:", ["Number of poles", "Rotor color", "Shaft length only", "Bearing type"], 0),
 ("A DC motor converts electrical energy into:", ["Mechanical energy", "Chemical energy", "Light only", "Potential energy"], 0),
 ("An ideal transformer changes voltage and current while approximately conserving:", ["Input and output power", "Frequency and resistance", "Flux and speed", "Copper mass"], 0),
 ("An induction motor rotor normally runs slightly below synchronous speed to produce:", ["Slip", "Unity power factor always", "Zero torque", "Infinite frequency"], 0),
 ("Transformer core laminations help reduce:", ["Eddy-current losses", "Copper resistance to zero", "Output frequency", "Turns ratio"], 0),
 ("The unit of magnetic flux is:", ["Weber", "Tesla per second", "Henry per meter", "Coulomb"], 0),
 ("A three-phase induction motor is self-starting because its stator creates:", ["A rotating magnetic field", "A stationary DC field only", "A mechanical spring", "A permanent battery"], 0),
 ("Back EMF in a motor generally opposes the:", ["Applied voltage", "Shaft rotation", "Magnetic field only", "Load torque only"], 0),
],
"Power Systems": [
 ("Electrical power is transmitted at high voltage mainly to reduce:", ["Current and I²R losses", "Frequency", "Conductor length", "Power factor to zero"], 0),
 ("A circuit breaker is designed to:", ["Interrupt fault current", "Generate electricity", "Increase load current", "Measure insulation thickness"], 0),
 ("The standard frequency in India's grid is:", ["25 Hz", "50 Hz", "60 Hz", "100 Hz"], 1),
 ("A busbar in a substation is a:", ["Common electrical connection point", "Mechanical fuse", "Protective helmet", "Rotating machine"], 0),
 ("A protective relay detects abnormal conditions and:", ["Signals a breaker to isolate the fault", "Raises the supply frequency", "Stores energy", "Changes the turbine fuel"], 0),
 ("Power factor is the ratio of real power to:", ["Apparent power", "Reactive current", "Resistance", "Frequency"], 0),
 ("A lightning arrester protects equipment from:", ["Transient overvoltages", "Low room temperature", "Mechanical vibration only", "Normal load current"], 0),
 ("A distribution transformer usually supplies power closer to:", ["End users", "Generating station only", "The turbine shaft", "A control-room display"], 0),
 ("A three-phase system can deliver more power with less conductor material than a comparable:", ["Single-phase system", "DC battery", "Lighting circuit", "Control signal"], 0),
],
"Control Systems": [
 ("A closed-loop control system uses:", ["Feedback", "No measured output", "Only an open switch", "A fixed input with no response"], 0),
 ("The difference between a reference and measured output is the:", ["Error signal", "Carrier signal", "Noise margin", "Transfer loss"], 0),
 ("A transfer function is commonly defined in the:", ["Laplace domain", "Time zone", "Frequency unit only", "Spatial domain only"], 0),
 ("Negative feedback generally reduces sensitivity to:", ["Parameter variations", "Reference input", "All stability", "The measured output"], 0),
 ("A system is stable if its natural response:", ["Decays with time", "Grows without bound", "Always oscillates forever", "Ignores initial conditions"], 0),
 ("A proportional controller output is proportional to:", ["Current error", "Integral of speed only", "Noise power", "The plant's age"], 0),
 ("In a block diagram, a summing junction combines:", ["Signals algebraically", "Only resistors", "Mechanical gears", "Database records"], 0),
 ("A pole of a continuous-time system in the right half-plane usually indicates:", ["Instability", "Guaranteed zero steady-state error", "No dynamics", "A digital input"], 0),
 ("A step response shows system behavior after a:", ["Sudden constant input change", "Random hardware failure", "Change of units only", "Zero input forever"], 0),
],
"Thermodynamics": [
 ("The first law of thermodynamics expresses conservation of:", ["Energy", "Mass number only", "Entropy only", "Pressure"], 0),
 ("In an ideal gas, the equation of state is:", ["PV = nRT", "P = V/R", "PT = n/V", "PV = R/T"], 0),
 ("Heat naturally flows from:", ["Higher temperature to lower temperature", "Lower temperature to higher temperature", "Low pressure to high pressure only", "A vacuum to every solid"], 0),
 ("For a reversible process, entropy change is related to heat transfer divided by:", ["Absolute temperature", "Pressure squared", "Volume", "Mass flow rate"], 0),
 ("The efficiency of a heat engine cannot exceed the Carnot limit for the same:", ["Reservoir temperatures", "Fuel color", "Piston diameter only", "Working-fluid name"], 0),
 ("At constant pressure, heat added to a simple closed system is associated with change in:", ["Enthalpy", "Viscosity only", "Specific volume only", "Molecular count"], 0),
 ("A refrigerator moves heat from a colder space by:", ["Receiving work input", "Producing energy from nothing", "Removing its condenser", "Stopping all heat transfer"], 0),
 ("In an Otto cycle, heat addition is ideally modeled at constant:", ["Volume", "Pressure", "Temperature", "Entropy"], 0),
 ("The SI unit of specific heat capacity is:", ["J/(kg·K)", "W/m", "Pa·s", "N/m²"], 0),
],
"Manufacturing": [
 ("Casting shapes a part by pouring molten material into a:", ["Mould cavity", "Gear train", "Cutting tool", "Winding"], 0),
 ("A lathe primarily rotates the:", ["Workpiece", "Tool magazine", "Floor plate", "Coolant tank"], 0),
 ("Welding joins parts primarily through:", ["Heat and/or pressure", "Lubrication only", "Painting", "Casting sand"], 0),
 ("A milling machine commonly uses a:", ["Rotating multi-edge cutter", "Stationary mould only", "Hand saw only", "Welding arc only"], 0),
 ("A tolerance specifies an allowed range for a:", ["Dimension", "Material color", "Machine brand", "Operator shift"], 0),
 ("CNC machine motion is controlled by:", ["Programmed numerical instructions", "A casting mould", "Steam pressure only", "Manual filing alone"], 0),
 ("A jig commonly guides the tool, while a fixture mainly:", ["Holds the workpiece", "Measures temperature", "Creates a drawing", "Changes the alloy"], 0),
 ("Surface roughness describes:", ["Small surface texture variations", "Part mass", "Heat capacity", "Tool speed only"], 0),
 ("Powder metallurgy forms parts by compacting powder and then:", ["Sintering it", "Dissolving it in water", "Electroplating it only", "Cooling it below room temperature"], 0),
],
"Strength of Materials": [
 ("Normal stress is axial force divided by:", ["Cross-sectional area", "Length squared", "Volume", "Time"], 0),
 ("Strain is the ratio of extension to:", ["Original length", "Cross-sectional area", "Applied force", "Young's modulus"], 0),
 ("Young's modulus is the ratio of stress to:", ["Strain in the elastic range", "Applied mass", "Poisson ratio", "Bending moment"], 0),
 ("A tensile load tends to:", ["Stretch a member", "Shorten it", "Twist it only", "Remove its supports"], 0),
 ("The bending moment unit is:", ["N·m", "N/m²", "kg/m³", "J/s²"], 0),
 ("For a circular shaft under torsion, shear stress is greatest at the:", ["Outer surface", "Center axis", "Neutral plane only", "Support center"], 0),
 ("A simply supported beam under a central point load has maximum bending moment at:", ["Midspan", "Either support", "One quarter span always", "Outside the beam"], 0),
 ("The factor of safety compares failure strength with:", ["Working stress", "Beam length", "Mass density", "Temperature"], 0),
 ("Buckling is a stability failure commonly seen in a slender member under:", ["Compression", "Pure tension", "Uniform heating", "Zero load"], 0),
],
"Surveying": [
 ("Levelling is primarily used to determine:", ["Elevation differences", "Chemical composition", "Wind speed", "Material hardness"], 0),
 ("A theodolite is used to measure:", ["Horizontal and vertical angles", "Mass and density", "Current and voltage", "Concrete strength"], 0),
 ("A benchmark is a point with a known:", ["Elevation", "Bearing material", "Pipe diameter", "Soil color"], 0),
 ("A total station combines electronic distance measurement with:", ["Angle measurement", "Concrete mixing", "Soil compaction", "Photographic printing"], 0),
 ("A contour line connects points of equal:", ["Elevation", "Slope direction", "Temperature", "Distance from the road"], 0),
 ("In a closed traverse, the final point should:", ["Close on the starting point", "Always be due north", "Have zero elevation", "Be outside the survey area"], 0),
 ("A backsight in levelling is typically taken on a point of known:", ["Reduced level", "Concrete grade", "Magnetic declination", "Pipe pressure"], 0),
 ("A scale of 1:1000 means 1 cm on the plan represents:", ["10 m on the ground", "1 m", "100 m", "1 km"], 0),
 ("GNSS surveying determines position using signals from:", ["Navigation satellites", "Underground cables", "Water levels", "Road markings only"], 0),
],
"Structural Engineering": [
 ("A beam mainly resists loads through:", ["Bending and shear", "Chemical reaction", "Electrical conduction", "Fluid mixing"], 0),
 ("A column is primarily designed to carry:", ["Axial compression", "Pure torsion only", "Surface paint", "Electrical current"], 0),
 ("The neutral axis in a beam has zero:", ["Longitudinal bending strain", "Shear force everywhere", "Support reaction", "Material density"], 0),
 ("A simply supported beam has supports that allow rotation and usually prevent:", ["Vertical translation", "All rotation", "Thermal expansion", "Material yielding"], 0),
 ("A truss member is ideally loaded in:", ["Axial tension or compression", "Uniform torsion only", "Hydrostatic pressure", "Surface friction"], 0),
 ("A structural load path describes how loads travel to:", ["The foundations and ground", "The building paint", "A power socket", "The weather station"], 0),
 ("Reinforcement in concrete is placed to help resist:", ["Tensile forces", "Only dead weight", "Water absorption", "Temperature measurement"], 0),
 ("The deflection of a beam is its:", ["Displacement from the unloaded shape", "Mass per unit length", "Support reaction", "Concrete slump"], 0),
 ("A structure's factor of safety accounts for uncertainty in loads and:", ["Material capacity", "Building color", "Room count", "Survey scale"], 0),
],
"Concrete Technology": [
 ("The water-cement ratio strongly affects concrete:", ["Strength and workability", "Rebar length only", "Aggregate color", "Curing temperature only"], 0),
 ("Concrete curing helps maintain conditions for:", ["Cement hydration", "Steel melting", "Aggregate separation", "Paint drying"], 0),
 ("Slump testing is a field measure of fresh concrete:", ["Workability", "Compressive strength directly", "Cement purity", "Rebar corrosion rate"], 0),
 ("Fine aggregate in concrete is commonly:", ["Sand", "Coarse gravel only", "Rebar", "Cement clinker only"], 0),
 ("A lower water-cement ratio generally increases strength when concrete is:", ["Properly compacted and cured", "Never mixed", "Made without cement", "Left completely dry"], 0),
 ("The main binder in ordinary Portland cement concrete is:", ["Hydrated cement paste", "Steel mesh", "Bitumen", "Clay brick"], 0),
 ("Air entrainment is useful in concrete exposed to:", ["Freeze-thaw cycles", "Indoor lighting", "High electrical current", "Static loading only"], 0),
 ("A cube or cylinder compression test measures concrete:", ["Compressive strength", "Slump", "Tensile strain only", "Setting temperature"], 0),
 ("Reinforcing steel and concrete work well together partly because they have similar:", ["Thermal expansion behavior", "Electrical resistance", "Color", "Density"], 0),
],
}
BONUS_QUESTIONS = {
"Python": ("What does enumerate(items) provide during iteration?", ["Index and item", "Only the last item", "A sorted copy", "A dictionary"], 0),
"Java": ("Which keyword refers to the current object?", ["this", "self", "current", "super"], 0),
"C": ("What does calloc initialize allocated memory to?", ["Zero bytes", "Random bytes", "ASCII spaces", "NULL pointers only"], 0),
"C++": ("Which pointer type manages ownership automatically in modern C++?", ["unique_ptr", "void*", "raw_ptr", "register"], 0),
"SQL": ("Which command removes all rows but keeps a table definition?", ["DROP", "TRUNCATE", "REMOVE", "DELETE TABLE"], 1),
"Data Structures": ("What is the worst-case time of linear search?", ["O(1)", "O(log n)", "O(n)", "O(n²)"], 2),
"Machine Learning": ("What does recall measure?", ["TP/(TP+FN)", "TP/(TP+FP)", "Correct/total", "TN/(TN+FP)"], 0),
"Web Development": ("Which browser API can select an element by CSS selector?", ["document.querySelector", "window.fetch", "console.table", "history.pushState"], 0),
"Aptitude": ("A number rises from 80 to 100. What is the percentage increase?", ["20%", "25%", "30%", "40%"], 1),
"Digital Electronics": ("A NOR gate is an OR gate followed by a:", ["NOT gate", "XOR gate", "Buffer", "Latch"], 0),
"Embedded Systems": ("PWM controls average output by varying the signal's:", ["Duty cycle", "Wire color", "Program size", "Crystal shape"], 0),
"Communication Systems": ("The unit commonly used for power gain is:", ["Decibel", "Farad", "Weber", "Ohm-meter"], 0),
"Electrical Machines": ("A transformer requires a changing magnetic flux to induce:", ["EMF", "Mechanical friction", "DC torque", "Capacitance"], 0),
"Power Systems": ("The per-unit system expresses quantities relative to selected:", ["Base values", "Cable colors", "Switch positions", "Weather readings"], 0),
"Control Systems": ("The steady-state error is the error remaining after:", ["Transient response has settled", "The input is removed", "Power is disconnected", "The sensor is removed"], 0),
"Thermodynamics": ("A process at constant temperature is called:", ["Isothermal", "Isobaric", "Isochoric", "Adiabatic"], 0),
"Manufacturing": ("A caliper is commonly used to measure:", ["External, internal and depth dimensions", "Electrical resistance", "Heat flow", "Sound pressure"], 0),
"Strength of Materials": ("Poisson's ratio relates lateral strain to:", ["Longitudinal strain", "Bending moment", "Applied heat", "Shear force"], 0),
"Surveying": ("A contour interval is the vertical difference between adjacent:", ["Contour lines", "Benchmarks only", "Road edges", "Survey stations"], 0),
"Structural Engineering": ("A fixed support can resist force and:", ["Moment", "Only vertical movement", "Temperature", "Material shrinkage"], 0),
"Concrete Technology": ("A standard concrete mix's aggregate provides:", ["Bulk and dimensional stability", "Hydration water only", "Steel reinforcement", "Chemical curing"], 0),
}


def question_difficulty(index, total):
    easy_end = max(1, round(total * .3))
    hard_start = max(easy_end, total - max(1, round(total * .3)))
    return "Easy" if index < easy_end else "Hard" if index >= hard_start else "Medium"


def add_user(name, email, role, **kwargs):
    user=User.query.filter_by(email=email).first()
    if user:return user
    user=User(name=name,email=email,password_hash=generate_password_hash("Campuslink123!"),role=role,phone=kwargs.pop("phone", ""));db.session.add(user);db.session.flush();return user


def run_seed():
    db.create_all()
    ensure_schema_compatibility()
    for name in BRANCHES:
        if not Branch.query.filter_by(name=name).first():db.session.add(Branch(name=name))
    for name in SKILLS:
        if not Skill.query.filter_by(name=name).first():db.session.add(Skill(name=name,category="Technical"))
    db.session.flush()
    skillmap={s.name:s for s in Skill.query.all()};branchmap={b.name:b for b in Branch.query.all()}
    companies=[]
    for i,name in enumerate(COMPANIES):
        user=add_user(f"{name} Recruiter",f"recruiter{i+1}@campuslink.demo","COMPANY")
        company=Company.query.filter_by(user_id=user.id).first()
        if not company:
            company=Company(user_id=user.id,company_name=name,description=f"{name} builds products and services for growing teams.",industry=["Software","Analytics","Cloud","Consulting"][i%4],website=f"https://{name.lower().replace(' ','')}.example",location=["Bengaluru","Pune","Hyderabad","Remote"][i%4],recruiter_name=user.name);db.session.add(company);db.session.flush()
        companies.append(company)
    students=[]
    for i in range(50):
        name=f"{FIRST[i%len(FIRST)]} {LAST[(i//len(FIRST)+i)%len(LAST)]}"
        email=f"student{i+1:02d}@campuslink.demo";user=add_user(name,email,"STUDENT",phone=f"+91 98{random.randint(10000000,99999999)}")
        student=Student.query.filter_by(user_id=user.id).first()
        if not student:
            student=Student(user_id=user.id,student_number=f"CL{user.id:05d}",branch_id=branchmap[BRANCHES[i%len(BRANCHES)]].id,year=4,semester=8,cgpa=round(random.uniform(6.4,9.8),2),attendance=round(random.uniform(72,99),1),career_goal=["Software Engineer","Data Analyst","Machine Learning Engineer","Cloud Engineer"][i%4],bio="Final-year student building practical projects and preparing for campus placements.");db.session.add(student);db.session.flush()
        if not StudentSkill.query.filter_by(student_id=student.id).first():
            chosen=random.sample(SKILLS,random.randint(5,10))
            for skillname in chosen:db.session.add(StudentSkill(student_id=student.id,skill_id=skillmap[skillname].id,proficiency=random.randint(45,95)))
        students.append(student)
    db.session.flush()
    roles=["Software Engineer","Data Analyst","Machine Learning Intern","Backend Developer","Cloud Associate","QA Engineer","Business Analyst","Frontend Developer","Data Engineer","Graduate Engineer Trainee","Java Developer","Python Developer","Product Analyst","DevOps Associate","Full Stack Developer","AI Engineer","Systems Engineer","SQL Developer","Support Engineer","Research Intern"]
    jobs=[]
    for i,title in enumerate(roles):
        job=Job.query.filter_by(company_id=companies[i%10].id,title=title).first()
        req=random.sample(SKILLS,random.randint(3,5))
        if not job:
            job=Job(company_id=companies[i%10].id,title=title,description=f"Join the {title} team to solve practical customer and product problems. Work with cross-functional teams, write clear documentation, and learn through mentorship.",minimum_cgpa=round(random.choice([6.0,6.5,7.0,7.5]),1),minimum_attendance=random.choice([70,75,80]),eligible_branches=json.dumps(random.sample(BRANCHES,random.randint(3,6))),experience="Fresher / 0–1 years",certifications=json.dumps([]),salary=f"{random.randint(4,9)}–{random.randint(10,18)} LPA",location=["Bengaluru","Pune","Hyderabad","Remote"][i%4],vacancies=random.randint(2,8),deadline=date.today()+timedelta(days=random.randint(15,90)),terms="Shortlisted candidates may be invited to an assessment and interview.");db.session.add(job);db.session.flush()
            for n in req:db.session.add(JobSkill(job_id=job.id,skill_id=skillmap[n].id))
        jobs.append(job)
    db.session.flush()
    # Fifty unique applications with varied funnel stages.
    statuses=["Applied","Applied","Shortlisted","Assessment","Interview","Selected","Rejected"]
    for i in range(50):
        student=students[i];job=jobs[(i*7)%len(jobs)]
        if not Application.query.filter_by(student_id=student.id,job_id=job.id).first():db.session.add(Application(student_id=student.id,job_id=job.id,status=statuses[i%len(statuses)],match_score=random.randint(55,97)))
    for i,student in enumerate(students[:20]):
        if not Project.query.filter_by(student_id=student.id).first():db.session.add(Project(student_id=student.id,title=["Campus Event Portal","Retail Demand Dashboard","Study Planner","Placement Prep Bot","Traffic Sign Classifier"][i%5]+f" {i+1}",description="Built a working project with a documented workflow, user feedback and measurable outcomes.",technologies=json.dumps(random.sample(SKILLS,3)),github_url="https://github.com/example/campus-project",status="Pending"))
        if not Internship.query.filter_by(student_id=student.id).first():db.session.add(Internship(student_id=student.id,company=COMPANIES[i%10],role=["Software Intern","Data Intern","QA Intern"][i%3],duration=f"{6+i%6} weeks",description="Contributed to a supervised team project and documented work completed.",status="Pending"))
        if not Certificate.query.filter_by(student_id=student.id).first():
            certificate=Certificate(student_id=student.id,name=["Python for Everybody","SQL Foundations","Introduction to Machine Learning"][i%3],certificate_type="NPTEL" if i%2==0 else "Course",certificate_id=f"CL-CERT-{i+1:04d}",issuer="NPTEL" if i%2==0 else "Campus Learning",completion_date=date.today()-timedelta(days=random.randint(30,500)),status="REQUIRES_REVIEW");db.session.add(certificate);db.session.flush()
            if certificate.certificate_type=="NPTEL":db.session.add(NptelCertificate(certificate_id=certificate.id,course_name=certificate.name,score=round(random.uniform(65,96),1)))
    db.session.flush()
    for i in range(12):
        student=students[i]
        if not Placement.query.filter_by(student_id=student.id).first():db.session.add(Placement(student_id=student.id,company_id=companies[i%10].id,job_id=jobs[i%20].id,package_lpa=round(random.uniform(5.5,18),2),placement_date=date.today()-timedelta(days=random.randint(1,300))))
    # Ten local quizzes with 10 questions each (100 total); no external service.
    all_question_banks = {**QUESTION_BANK, **BRANCH_QUESTION_BANK}
    for category, questions in all_question_banks.items():
        quiz=Quiz.query.filter_by(title=f"{category} Quick Check").first()
        if not quiz:
            quiz=Quiz(title=f"{category} Quick Check",category=category,duration_minutes=12);db.session.add(quiz);db.session.flush()
        if QuizQuestion.query.filter_by(quiz_id=quiz.id).count()==0:
            for index, item in enumerate(questions):
                prompt, options, answer = item[:3]
                options = list(options)
                if category in BRANCH_QUESTION_BANK:
                    correct = options[answer]
                    random.Random(f"{category}:{prompt}").shuffle(options)
                    answer = options.index(correct)
                explanation = item[3] if len(item) > 3 else f"Correct answer: {options[answer]}. This follows the core {category.lower()} principle tested by the question."
                topic = infer_quiz_question_topic(QuizQuestion(prompt=prompt, options=json.dumps(options), explanation=explanation), category)
                db.session.add(QuizQuestion(quiz_id=quiz.id,prompt=prompt,options=json.dumps(options),answer_index=answer,explanation=explanation,difficulty=question_difficulty(index,len(questions)),topic=topic))
        if QuizQuestion.query.filter_by(quiz_id=quiz.id).count() == len(questions) and category in BONUS_QUESTIONS:
            prompt, options, answer = BONUS_QUESTIONS[category]
            options = list(options)
            if category in BRANCH_QUESTION_BANK:
                correct = options[answer]
                random.Random(f"{category}:{prompt}").shuffle(options)
                answer = options.index(correct)
            explanation = f"Correct answer: {options[answer]}. This follows the core {category.lower()} principle tested by the question."
            topic = infer_quiz_question_topic(QuizQuestion(prompt=prompt, options=json.dumps(options), explanation=explanation), category)
            db.session.add(QuizQuestion(quiz_id=quiz.id,prompt=prompt,options=json.dumps(options),answer_index=answer,explanation=explanation,difficulty="Hard",topic=topic))
    # This gives the eight technical quizzes 11 each. Aptitude has 12 questions,
    # producing a curated 100-question local bank overall.
    aptitude=Quiz.query.filter_by(title="Aptitude Quick Check").first()
    if aptitude and QuizQuestion.query.filter_by(quiz_id=aptitude.id).count()==11:
        db.session.add(QuizQuestion(quiz_id=aptitude.id,prompt="A team completes 3 tasks per day for 4 days. How many tasks?",options=json.dumps(["7","12","14","9"]),answer_index=1,explanation="Multiply the daily rate by the number of days." ,difficulty="Hard",topic="Quantitative Reasoning"))
    # Curated local learning catalogue with no recommendation API.
    if Course.query.count()==0:
        for skill in SKILLS[:18]:
            db.session.add(Course(title=f"{skill} Foundations",skill=skill,level="Beginner",url=learning_resource_url(skill),duration="3–6 hours"))
            db.session.add(Course(title=f"Build a Practical {skill} Project",skill=skill,level="Intermediate",url=learning_resource_url(skill, project=True),duration="Self-paced"))
    sync_learning_resource_urls()
    if InterviewQuestion.query.count()==0:
        bank=[("General","Tell me about a project you are proud of.",["project","built","challenge","result"]),("General","Describe a time you learned something quickly.",["learned","practice","feedback","result"]),("Python","How would you use a dictionary to count word frequencies?",["dictionary","key","count","iterate"]),("Python","Explain the difference between a list and a tuple.",["mutable","immutable","list","tuple"]),("SQL","How would you find duplicate email addresses in a table?",["group by","count","having","email"]),("SQL","Explain the difference between INNER JOIN and LEFT JOIN.",["matching","rows","left","null"]),("Machine Learning","What steps would you take to reduce overfitting?",["validation","regularization","data","model"]),("Data Structures","When would you choose a queue over a stack?",["fifo","lifo","order","queue"]),("Java","What is the purpose of an interface in Java?",["contract","methods","implement","class"]),("HR","How do you respond to constructive feedback?",["feedback","listen","action","improve"])]
        for cat,prompt,keywords in bank:db.session.add(InterviewQuestion(category=cat,prompt=prompt,expected_keywords=json.dumps(keywords)))
    db.session.commit()
    print("CAMPUSLINK demo data is ready.")
    print("Student: student01@campuslink.demo / Campuslink123!")
    print("Company: recruiter1@campuslink.demo / Campuslink123!")
    print("Placement Officer: admin@campuslink.demo / Campuslink123!")
    print("Demo students: student01@campuslink.demo through student50@campuslink.demo")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_schema_compatibility()
        admin=add_user("Placement Officer","admin@campuslink.demo","ADMIN")
        if not __import__("models").PlacementOfficer.query.filter_by(user_id=admin.id).first():db.session.add(__import__("models").PlacementOfficer(user_id=admin.id))
        run_seed()
