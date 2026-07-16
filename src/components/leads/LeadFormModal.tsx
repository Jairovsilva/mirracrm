'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore, type Stage, type Temperature } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Search, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadFormModalProps {
  leadId: string | null;
  onClose: () => void;
}

interface CnpjSocio {
  nome: string;
  cargo: string;
}

export function LeadFormModal({ leadId, onClose }: LeadFormModalProps) {
  const { t } = useTranslation();
  const leads = useCRMStore((s) => s.leads);
  const addLead = useCRMStore((s) => s.addLead);
  const updateLead = useCRMStore((s) => s.updateLead);

  const editingLead = leadId ? leads.find((l) => l.id === leadId) : null;

  const [form, setForm] = useState({
    nome: '',
    cargo: '',
    emailCorporativo: '',
    linkedin: '',
    telefoneCelular: '',
    telefoneFixo: '',
    nomeEmpresa: '',
    cnpj: '',
    temperatura: 'morno' as Temperature,
    stage: 'entrada' as Stage,
    valorProposta: '' as string | number,
    motivoPerda: '',
  });

  // 🆕 Busca pública de CNPJ (Receita Federal via BrasilAPI)
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [cnpjSocios, setCnpjSocios] = useState<CnpjSocio[]>([]);

  useEffect(() => {
    if (editingLead) {
      setForm({
        nome: editingLead.nome || '',
        cargo: editingLead.cargo || '',
        emailCorporativo: editingLead.emailCorporativo || '',
        linkedin: editingLead.linkedin || '',
        telefoneCelular: editingLead.telefoneCelular || '',
        telefoneFixo: editingLead.telefoneFixo || '',
        nomeEmpresa: editingLead.nomeEmpresa || '',
        cnpj: editingLead.cnpj || '',
        temperatura: editingLead.temperatura || 'morno',
        stage: editingLead.stage || 'entrada',
        valorProposta: editingLead.valorProposta || '',
        motivoPerda: editingLead.motivoPerda || '',
      });
    }
  }, [editingLead]);

  const handleBuscarCnpj = async () => {
    const cnpjLimpo = form.cnpj.replace(/[^0-9]/g, '');
    setCnpjError('');
    setCnpjSocios([]);

    if (cnpjLimpo.length !== 14) {
      setCnpjError('Digite um CNPJ válido (14 dígitos) antes de buscar.');
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await fetch(`/api/cnpj?cnpj=${cnpjLimpo}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setCnpjError(json.error || 'CNPJ não encontrado.');
        return;
      }

      const { razaoSocial, nomeFantasia, telefone, email, socios } = json.data;

      setForm((prev) => ({
        ...prev,
        nomeEmpresa: prev.nomeEmpresa || nomeFantasia || razaoSocial || prev.nomeEmpresa,
        telefoneFixo: prev.telefoneFixo || telefone || prev.telefoneFixo,
        emailCorporativo: prev.emailCorporativo || email || prev.emailCorporativo,
      }));

      setCnpjSocios(socios || []);
    } catch (err) {
      setCnpjError('Erro ao consultar o CNPJ. Tente novamente.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.nome || !form.nomeEmpresa) return;

    const leadData = {
      nome: form.nome,
      cargo: form.cargo,
      emailCorporativo: form.emailCorporativo,
      linkedin: form.linkedin,
      telefoneCelular: form.telefoneCelular,
      telefoneFixo: form.telefoneFixo,
      nomeEmpresa: form.nomeEmpresa,
      cnpj: form.cnpj,
      temperatura: form.temperatura,
      stage: form.stage,
      valorProposta: form.valorProposta ? Number(form.valorProposta) : 0,
      motivoPerda: form.motivoPerda || undefined,
    };

    if (editingLead) {
      updateLead(editingLead.id, leadData);
    } else {
      addLead(leadData);
    }
    onClose();
  };

  const inputFields = [
    { key: 'nome', label: t.lead.name, required: true, type: 'text' },
    { key: 'cargo', label: t.lead.role, type: 'text' },
    { key: 'emailCorporativo', label: t.lead.email, type: 'email' },
    { key: 'linkedin', label: t.lead.linkedin, type: 'text' },
    { key: 'telefoneCelular', label: t.lead.cellPhone, type: 'tel' },
    { key: 'telefoneFixo', label: t.lead.landline, type: 'tel' },
    { key: 'nomeEmpresa', label: t.lead.company, required: true, type: 'text' },
    { key: 'valorProposta', label: t.lead.proposalValue, type: 'number' },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto animate-scale-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold">{editingLead ? t.lead.editLead : t.lead.addLead}</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inputFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-xs font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    value={String(form[field.key as keyof typeof form])}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="h-10"
                  />
                </div>
              ))}

              {/* CNPJ + busca automática */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cnpj" className="text-xs font-medium">{t.lead.cnpj}</Label>
                <div className="flex gap-2">
                  <Input
                    id="cnpj"
                    type="text"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="h-10 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBuscarCnpj}
                    disabled={cnpjLoading}
                    className="h-10 shrink-0"
                  >
                    {cnpjLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Buscar dados</span>
                  </Button>
                </div>

                {cnpjError && (
                  <p className="text-xs text-destructive">{cnpjError}</p>
                )}

                {cnpjSocios.length > 0 && (
                  <div className="mt-2 p-3 rounded-lg border border-border bg-secondary/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      Sócios/administradores encontrados na Receita Federal (referência — não preenchido automaticamente):
                    </div>
                    <ul className="space-y-1">
                      {cnpjSocios.map((s, i) => (
                        <li key={i} className="text-xs text-foreground">
                          <span className="font-medium">{s.nome}</span>
                          {s.cargo && <span className="text-muted-foreground"> — {s.cargo}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Dados públicos da Receita Federal (razão social, telefone, e-mail e sócios). Empresa, telefone e e-mail só são preenchidos se estiverem vazios.
                </p>
              </div>

              {/* Temperature selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.lead.temperature}</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['frio', 'morno', 'quente'] as Temperature[]).map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setForm({ ...form, temperatura: temp })}
                      className={cn(
                        'py-2 rounded-lg border text-xs font-medium transition-all capitalize',
                        form.temperatura === temp
                          ? temp === 'frio'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                            : temp === 'morno'
                            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                            : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                          : 'border-border text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {t.temperature[temp]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.lead.stage}</Label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="entrada">{t.stages.entrada}</option>
                  <option value="enriquecer">{t.stages.enriquecer}</option>
                  <option value="reuniao">{t.stages.reuniao}</option>
                  <option value="fim_cadencia">{t.stages.fim_cadencia}</option>
                </select>
              </div>

              {/* Loss reason */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="motivoPerda" className="text-xs font-medium">{t.lead.lossReason}</Label>
                <Textarea
                  id="motivoPerda"
                  value={form.motivoPerda}
                  onChange={(e) => setForm({ ...form, motivoPerda: e.target.value })}
                  className="min-h-[60px] resize-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={!form.nome || !form.nomeEmpresa}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}