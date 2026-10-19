import { DentalService } from '../types';

export const CLINIC_SERVICES: DentalService[] = [
  {
    id: 'scaling',
    name: 'Teeth Cleaning & Scaling',
    category: 'Preventative',
    priceETB: '1,200 ETB',
    duration: '45 mins',
    description: 'Ultrasonic removal of hardened calculus, plaque, and surface stains to prevent gingivitis and periodontitis.',
    benefits: ['Prevents gum disease & bleeding', 'Freshens breath', 'Polishing included'],
    recommendedInterval: 'Every 6 months'
  },
  {
    id: 'filling',
    name: 'Composite Dental Fillings',
    category: 'Restorative',
    priceETB: '1,500 - 2,500 ETB',
    duration: '30 - 60 mins',
    description: 'Tooth-colored resin restoration that seamlessly blends with your natural teeth while halting decay.',
    benefits: ['Matches enamel shade', 'Bonds directly to tooth', 'Preserves natural structure'],
    recommendedInterval: 'As needed upon cavity detection'
  },
  {
    id: 'root-canal',
    name: 'Root Canal Therapy (Endodontics)',
    category: 'Therapeutic',
    priceETB: '4,500 - 7,000 ETB',
    duration: '60 - 90 mins',
    description: 'Careful removal of infected pulp tissue, sanitization of canals, and sterile sealing to save your natural tooth from extraction.',
    benefits: ['Immediate pain relief', 'Saves tooth from extraction', 'Restores full chewing power'],
    recommendedInterval: 'Urgent for deep pulp infection'
  },
  {
    id: 'whitening',
    name: 'Laser Teeth Whitening',
    category: 'Cosmetic',
    priceETB: '3,800 ETB',
    duration: '60 mins',
    description: 'Professional in-clinic cold-light bleaching that brightens smile shades safely without enamel damage.',
    benefits: ['Up to 6 shades lighter', 'Safe for sensitive gums', 'Immediate results'],
    recommendedInterval: 'Once every 1 - 2 years'
  },
  {
    id: 'orthodontics',
    name: 'Orthodontic / Braces Consultation',
    category: 'Orthodontics',
    priceETB: '500 ETB (Consultation)',
    duration: '45 mins',
    description: 'Digital 3D cephalometric assessment for traditional metal brackets, ceramic braces, and clear aligners.',
    benefits: ['Corrects bite & crowding', 'Improves facial symmetry', 'Custom treatment timeline'],
    recommendedInterval: 'Initial consultation'
  },
  {
    id: 'emergency',
    name: 'Emergency Dental Care & Extraction',
    category: 'Emergency',
    priceETB: '1,000 - 3,000 ETB',
    duration: '30 mins',
    description: 'Same-day urgent treatment for severe acute toothache, broken crowns, dental abscesses, or facial swelling.',
    benefits: ['Immediate triage', 'Local anesthesia for zero pain', 'Same-day appointments'],
    recommendedInterval: 'Immediate upon trauma or acute pain'
  }
];

export const CLINIC_DOCTORS = [
  { name: 'Dr. Dawit Haile, DDS', specialty: 'Senior Implantologist & Oral Surgeon', experience: '14 years' },
  { name: 'Dr. Sara Tesfaye, DMD', specialty: 'Restorative & Pediatric Dentist', experience: '9 years' },
  { name: 'Dr. Michael Bekele, BDS', specialty: 'Orthodontics & Aesthetic Dentistry', experience: '11 years' },
];

export const SAMPLE_QUESTIONS = [
  { text: "I need a tooth cleaning", label: "Cleaning (RAG)", category: "service" },
  { text: "How much does a dental filling cost?", label: "Price Query", category: "price" },
  { text: "Can I book an appointment for tomorrow morning?", label: "Booking Slot", category: "booking" },
  { text: "I have a severe toothache that keeps me awake", label: "Emergency", category: "emergency" },
  { text: "ሰላም የጥርስ ህክምና ቀጠሮ ማስያዝ እፈልጋለሁ", label: "Amharic Fidel", category: "amharic" },
  { text: "What medicine should I take for a severe headache?", label: "Guardrail Test", category: "guardrail" },
];

export const FORENSIC_REASONS = [
  {
    id: "single_shot_test",
    number: "01",
    tag: "PRIMARY ROOT CAUSE",
    title: "n8n Test Webhook Single-Shot Execution",
    badge: "Most Common Bug",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    summary: "Test webhooks in n8n (/webhook-test/...) only listen ONCE per manual click. They shut down immediately after receiving 1 request.",
    explanation: "When you are building workflows in n8n, clicking 'Listen for test event' opens a temporary 120-second socket. It accepts exactly ONE HTTP POST call to show data in the canvas. The split-second that call finishes, n8n closes the test listener. If you send a second message from your chat UI, n8n responds with 404 Not Found ('The workflow is not registered') and nothing appears to happen.",
    solution: "Change your webhook URL to the Production URL (/webhook/dental-chat) and toggle the workflow switch in the top right of n8n to 'ACTIVE'."
  },
  {
    id: "workflow_inactive",
    number: "02",
    tag: "STATUS MISMATCH",
    title: "Production Workflow is Inactive (Toggle is OFF)",
    badge: "Common Oversight",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
    summary: "Calling /webhook/dental-chat while the workflow switch is Inactive results in 404.",
    explanation: "Production webhooks (/webhook/...) do not require clicking 'Listen for test event', but they require the workflow itself to be Active. In n8n, whenever you import a new workflow or make major edits, n8n defaults it to 'Inactive'. Calling the production URL on an inactive workflow returns HTTP 404 and will never trigger.",
    solution: "Open n8n, look at the top-right corner of the canvas, and flip the toggle switch to 'Active' (it turns green)."
  },
  {
    id: "browser_mixed_content",
    number: "03",
    tag: "BROWSER SECURITY",
    title: "HTTPS to HTTP Mixed Content Block",
    badge: "Silent Failure",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    summary: "Modern browsers block frontend requests from https:// to http://localhost:5678.",
    explanation: "If you open your chat interface on an HTTPS URL (like Google Cloud Run, Vercel, or AI Studio preview) and your frontend tries to call 'http://localhost:5678' directly in JavaScript fetch, the browser blocks the request instantly. No packet is sent over the wire, and n8n never receives any trigger.",
    solution: "Send the request to the server-side proxy (/api/chat in server.ts), which communicates with n8n server-to-server with no browser CORS or Mixed Content restrictions."
  },
  {
    id: "canvas_vs_executions",
    number: "04",
    tag: "UI CONFUSION",
    title: "Production Webhooks Do Not Animate the Canvas",
    badge: "Misconception",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    summary: "In n8n, production triggers only log to the 'Executions' tab, not the visual node canvas.",
    explanation: "Many developers test their chat, see that the n8n nodes didn't turn green, and conclude 'the webhook did not trigger'. In reality, when using the production webhook (/webhook/...), n8n executes in the background. Node visual feedback only happens during manual test runs.",
    solution: "Click the 'Executions' tab on the left sidebar in n8n (icon with clock/list) to see every trigger, status, and payload."
  },
  {
    id: "docker_localhost",
    number: "05",
    tag: "CONTAINER NETWORKING",
    title: "Docker 'localhost' Isolation",
    badge: "Network Issue",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    summary: "'localhost:5678' inside a container refers to the container itself, not your host computer.",
    explanation: "If n8n is running on your host machine and your web app runs inside Docker (or vice versa), 'localhost' points inside the container where no n8n server exists, failing with ECONNREFUSED.",
    solution: "Use 'http://host.docker.internal:5678/webhook/dental-chat' or expose n8n with ngrok / Cloudflare Tunnel."
  }
];
