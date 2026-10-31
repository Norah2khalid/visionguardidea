import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HELPERS, UI } from "@/lib/content";
import { barcodeStorage, type Barcode } from "@/lib/barcodes";
import { validBarcodeFile } from "@/lib/idea-helpers";
import { supabase } from "@/integrations/supabase/client";
import { BarcodeImage } from "./BarcodeImage";

export function BarcodeManager() {
  const client = useQueryClient();
  const [edit, setEdit] = useState<Barcode | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState("problem_1");
  const [published, setPublished] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const { data: rows = [], isPending, isError } = useQuery({ queryKey: ["admin-barcodes"], queryFn: async () => {
    const { data, error } = await supabase.from("barcodes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } });
  useEffect(() => { const urls = files.map((f) => URL.createObjectURL(f)); setPreviews(urls); return () => urls.forEach(URL.revokeObjectURL); }, [files]);
  const refresh = () => { client.invalidateQueries({ queryKey: ["admin-barcodes"] }); client.invalidateQueries({ queryKey: ["published-barcodes"] }); };
  function reset() { setEdit(null); setTitle(""); setDescription(""); setSection("problem_1"); setPublished(false); setFiles([]); setInputKey((v) => v + 1); }
  function selectFiles(list: FileList | null) { const selected = Array.from(list ?? []); if (selected.some((file) => !validBarcodeFile(file))) { toast.error(UI.invalidImage); return; } setFiles(selected); }
  async function upload(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await barcodeStorage().upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) { toast.error(UI.titleRequired); return; }
    if (!edit && files.length === 0) { toast.error(UI.invalidImage); return; }
    setBusy(true);
    try {
      if (edit) {
        const file = files[0];
        const path = file ? await upload(file) : edit.image_path;
        const { error } = await supabase.from("barcodes").update({ title: title.trim(), description: description.trim(), section, published, image_path: path, original_name: file?.name ?? edit.original_name }).eq("id", edit.id);
        if (error) { if (file) await barcodeStorage().remove([path]); throw error; }
        if (file) { const { error: cleanupError } = await barcodeStorage().remove([edit.image_path]); if (cleanupError) toast.error(UI.operationError); }
      } else {
        for (const file of files) {
          const path = await upload(file);
          const { error } = await supabase.from("barcodes").insert({ title: files.length > 1 ? `${title.trim()} — ${file.name}` : title.trim(), description: description.trim(), section, published, image_path: path, original_name: file.name });
          if (error) { await barcodeStorage().remove([path]); throw error; }
        }
      }
      toast.success(UI.saved); reset();
    } catch { toast.error(UI.operationError); } finally { setBusy(false); refresh(); }
  }
  async function remove(row: Barcode) {
    if (!window.confirm(UI.confirmDelete)) return;
    setBusy(true);
    try {
      const { error: imageError } = await barcodeStorage().remove([row.image_path]); if (imageError) throw imageError;
      const { error } = await supabase.from("barcodes").delete().eq("id", row.id); if (error) throw error;
      if (edit?.id === row.id) reset(); toast.success(UI.deleted);
    } catch { toast.error(UI.operationError); } finally { setBusy(false); refresh(); }
  }
  async function toggle(row: Barcode, value: boolean) {
    setBusy(true); const { error } = await supabase.from("barcodes").update({ published: value }).eq("id", row.id); setBusy(false);
    if (error) toast.error(UI.operationError); else { toast.success(UI.saved); refresh(); }
  }
  return <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
    <section className="border-b pb-8"><h2 className="mb-6 text-xl font-bold">{edit ? UI.edit : UI.upload}</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><div><label htmlFor="barcode-title" className="mb-2 block">{UI.title}</label><Input id="barcode-title" required value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><label htmlFor="barcode-section" className="mb-2 block">{UI.section}</label><select id="barcode-section" className="h-10 w-full rounded-md border bg-card px-3" value={section} onChange={(e) => setSection(e.target.value)}>{HELPERS.map((helper) => <option key={helper.id} value={helper.id}>{helper.title}</option>)}</select></div></div>
        <div><label htmlFor="barcode-description" className="mb-2 block">{UI.description}</label><Textarea id="barcode-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label htmlFor="barcode-files" className="mb-2 flex items-center gap-2"><Upload className="h-4 w-4" />{edit ? UI.replace : UI.chooseFiles}</label><Input key={inputKey} id="barcode-files" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple={!edit} onChange={(e) => selectFiles(e.target.files)} /></div>
        {previews.length > 0 && <div><p className="mb-3 font-semibold">{UI.preview}</p><div className="flex flex-wrap gap-4">{previews.map((url, index) => <img key={url} src={url} alt={files[index]?.name ?? UI.preview} className="h-40 w-40 rounded-md border bg-card object-contain" />)}</div></div>}
        <label className="flex items-center gap-3"><Switch checked={published} onCheckedChange={setPublished} />{UI.publish}</label>
        <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{UI.save}</Button><Button type="button" variant="outline" onClick={reset} disabled={busy}>{UI.cancel}</Button></div>
      </form>
    </section>
    {isPending ? <Loader2 className="h-8 w-8 animate-spin" /> : isError ? <div role="alert">{UI.loadError}<Button variant="ghost" size="icon" aria-label={UI.loading} onClick={refresh}><RefreshCw className="h-4 w-4" /></Button></div> : rows.length === 0 ? <p className="py-12 text-center text-muted-foreground">{UI.empty}</p> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <article key={row.id} className="space-y-4 rounded-lg border bg-card p-5 shadow-soft"><BarcodeImage barcode={row} /><p className="text-sm text-muted-foreground">{HELPERS.find((helper) => helper.id === row.section)?.title}</p><label className="flex items-center gap-3"><Switch checked={row.published} disabled={busy} onCheckedChange={(value) => toggle(row, value)} />{row.published ? UI.published : UI.draft}</label><div className="flex gap-2"><Button variant="outline" size="icon" aria-label={UI.edit} title={UI.edit} disabled={busy} onClick={() => { setEdit(row); setTitle(row.title); setDescription(row.description); setSection(row.section); setPublished(row.published); setFiles([]); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="icon" aria-label={UI.delete} title={UI.delete} disabled={busy} onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></Button></div></article>)}</div>}
  </main>;
}
