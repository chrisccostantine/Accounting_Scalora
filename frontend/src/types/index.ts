export type ClientService = 'META_ADS' | 'TIKTOK_ADS' | 'GOOGLE_ADS' | 'SOCIAL_MEDIA_MANAGEMENT' | 'CONTENT_CREATION' | 'SHOPIFY_STORE' | 'WEBSITE_DEVELOPMENT' | 'WEB_APPLICATION' | 'MOBILE_APPLICATION' | 'BRANDING' | 'OTHER';
export type ClientStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type PaymentMethod = 'CASH' | 'BANK' | 'WHISH' | 'OMT' | 'TRANSFER' | 'OTHER';
export type PaymentFrequency = 'ONE_TIME' | 'MONTHLY' | 'YEARLY';
export type ExpenseCategory = 'OFFICE' | 'SOFTWARE' | 'ADS' | 'FREELANCER' | 'EMPLOYEE' | 'INTERNET' | 'PHONE' | 'TRANSPORTATION' | 'EQUIPMENT' | 'UTILITIES' | 'MARKETING' | 'OTHER';

export interface Client {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  service: ClientService;
  monthlyFee: number;
  billingFrequency: PaymentFrequency;
  currency: string;
  status: ClientStatus;
  contractStartDate: string;
  notes?: string;
  createdAt: string;
}

export interface Income {
  id: string;
  clientId: string;
  client?: Client;
  amount: number;
  currency: string;
  date: string;
  paymentMethod: PaymentMethod;
  frequency: PaymentFrequency;
  referenceNumber?: string;
  description?: string;
  invoiceNumber?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  frequency: PaymentFrequency;
  date: string;
  vendor?: string;
  receiptNumber?: string;
  notes?: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
