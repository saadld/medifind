-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  pharmacy_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id)
);
CREATE TABLE public.medicines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  form text,
  strength text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medicines_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pharmacies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  phone text,
  hours_json jsonb,
  services_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_on_call boolean DEFAULT false,
  user_id uuid,
  CONSTRAINT pharmacies_pkey PRIMARY KEY (id),
  CONSTRAINT pharmacies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.pill_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  medicine_name text NOT NULL,
  dosage text,
  times_per_day jsonb NOT NULL,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pill_reminders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  pharmacy_id uuid NOT NULL,
  medicine_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending'::text,
  prescription_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id),
  CONSTRAINT reservations_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id),
  CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  medicine_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_km double precision DEFAULT 10.0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT stock_alerts_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);
CREATE TABLE public.stocks (
  pharmacy_id uuid NOT NULL,
  medicine_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stocks_pkey PRIMARY KEY (pharmacy_id, medicine_id),
  CONSTRAINT stocks_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id),
  CONSTRAINT stocks_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
);