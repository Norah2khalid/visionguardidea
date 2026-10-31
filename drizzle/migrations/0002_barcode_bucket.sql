INSERT INTO storage.buckets (id, name, public)
VALUES ('event-barcodes', 'event-barcodes', false)
ON CONFLICT (id) DO NOTHING;
