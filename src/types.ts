export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  audio?: string | null;
  source?: 'n8n_live' | 'simulated_rag' | 'backend_error';
  sessionId?: string;
  error?: string | null;
  bookingIntent?: boolean;
  service?: string;
  price?: string;
  availableSlots?: string[];
  showForm?: boolean;
  guardrailTriggered?: boolean;
}

export interface DiagnosticResult {
  targetUrl: string;
  isTestUrl: boolean;
  isProdUrl: boolean;
  isLocalhost: boolean;
  reachable?: boolean;
  httpStatus?: number;
  httpStatusText?: string;
  durationMs?: number;
  responsePreview?: string;
  responseJson?: any;
  diagnosis?: string;
  diagnosisTitle?: string;
  rootCause?: string;
  errorName?: string;
  errorMessage?: string;
}

export interface DentalService {
  id: string;
  name: string;
  category: string;
  priceETB: string;
  duration: string;
  description: string;
  benefits: string[];
  recommendedInterval: string;
}

export interface BookingAppointment {
  bookingId: string;
  patientName: string;
  phone: string;
  service: string;
  slot: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  dentist: string;
  notes?: string;
  createdAt: string;
}
