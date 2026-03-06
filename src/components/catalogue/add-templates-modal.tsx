'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, Search, ChevronLeft } from 'lucide-react';
import { catalogueApi } from '@/lib/api/catalogue';
import type { ProductTemplate } from '@/types/catalogue';
import { feedback } from '@/lib/feedback';

const STEP_1 = 1;
const STEP_2 = 2;
const STEP_3 = 3;

export interface AddTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface TemplateCategory {
  id: string;
  name: string;
  templates: ProductTemplate[];
}

export function AddTemplatesModal({
  open,
  onOpenChange,
  onSuccess,
}: AddTemplatesModalProps) {
  const [step, setStep] = useState(STEP_1);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['product-templates', 'for-store'],
    queryFn: () => catalogueApi.productTemplates.getForStore(),
    enabled: open,
  });

  const categoriesWithTemplates = useMemo((): TemplateCategory[] => {
    const byCategory = new Map<string, TemplateCategory>();
    for (const t of templates) {
      const catId = t.categoryId || (t.category as { id?: string })?.id || '';
      const catName = (t.category as { name?: string })?.name ?? 'Uncategorized';
      if (!catId) continue;
      if (!byCategory.has(catId)) {
        byCategory.set(catId, { id: catId, name: catName, templates: [] });
      }
      byCategory.get(catId)!.templates.push(t);
    }
    return Array.from(byCategory.values());
  }, [templates]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoriesWithTemplates;
    const q = categorySearch.trim().toLowerCase();
    return categoriesWithTemplates.filter(
      (c) => c.name.toLowerCase().includes(q)
    );
  }, [categoriesWithTemplates, categorySearch]);

  const selectedCategories = useMemo(
    () => categoriesWithTemplates.filter((c) => selectedCategoryIds.has(c.id)),
    [categoriesWithTemplates, selectedCategoryIds]
  );

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInCategory = useCallback((category: TemplateCategory) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      for (const t of category.templates) next.add(t.id);
      return next;
    });
  }, []);

  const deselectAllInCategory = useCallback((category: TemplateCategory) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      for (const t of category.templates) next.delete(t.id);
      return next;
    });
  }, []);

  const totalSelectedCount = selectedTemplateIds.size;

  /** Categories that have at least one selected product (for Step 3) */
  const selectedCategoriesWithProducts = useMemo(
    () =>
      selectedCategories.filter((cat) =>
        cat.templates.some((t) => selectedTemplateIds.has(t.id))
      ),
    [selectedCategories, selectedTemplateIds]
  );

  const handleNextFromStep1 = useCallback(() => {
    const templateIds = new Set<string>();
    selectedCategories.forEach((c) => c.templates.forEach((t) => templateIds.add(t.id)));
    setSelectedTemplateIds(templateIds);
    setStep(STEP_2);
  }, [selectedCategories]);

  const handleFinish = useCallback(async () => {
    const items = selectedCategoriesWithProducts
      .map((cat) => ({
        categoryName: cat.name,
        productTemplateIds: cat.templates
          .filter((t) => selectedTemplateIds.has(t.id))
          .map((t) => t.id),
      }))
      .filter((item) => item.productTemplateIds.length > 0);

    if (items.length === 0) {
      feedback.error('Invalid selection', 'Select at least one product to add.', 'Go back and select products.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await catalogueApi.products.addTemplate({ items });
      const count = Array.isArray(created) ? created.length : 0;
      feedback.success('Products added', `${count} product(s) added to your catalogue. Categories are created if needed.`);
      onOpenChange(false);
      onSuccess?.();
      setStep(STEP_1);
      setSelectedCategoryIds(new Set());
      setSelectedTemplateIds(new Set());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
      const status = e?.response?.status;
      const data = e?.response?.data;
      const message = data?.message || (typeof data?.error === 'string' ? data.error : undefined);
      if (status === 400) {
        feedback.error('No store', message || 'Your account has no store assigned.', 'Contact support.');
      } else if (status === 403) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            console.warn(
              '[Add Templates] 403 Forbidden. Your app sees role:',
              user?.role ?? '(none)',
              '— Backend must allow role "store_admin" on GET /product-templates/for-store and POST /products/add-template; JWT must include this role.'
            );
          } catch {
            /* ignore */
          }
        }
        feedback.error(
          'Not allowed',
          message || 'The server rejected access (Store Admin only).',
          'If you are Store Admin: the backend must allow your role on the template and add-template endpoints. Otherwise contact support.'
        );
      } else if (status === 404) {
        feedback.error('Not found', message || 'Category or template not found.', 'Refresh and try again.');
      } else if (status === 409) {
        feedback.error('Duplicate', message || 'Some products already exist (template already added).', 'Edit or remove existing products.');
      } else {
        feedback.fromError(err, 'Failed to add products', 'Check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCategoriesWithProducts, selectedTemplateIds, onOpenChange, onSuccess]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(STEP_1, s - 1));
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setStep(STEP_1);
        setCategorySearch('');
        setSelectedCategoryIds(new Set());
        setSelectedTemplateIds(new Set());
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === STEP_1 && 'Add Templates'}
            {step === STEP_2 && 'Select products'}
            {step === STEP_3 && 'Summary'}
          </DialogTitle>
          <DialogDescription>
            {step === STEP_1 && 'Choose template categories from the Admin Portal, then click Next.'}
            {step === STEP_2 && 'Select which products to add. You can expand each category.'}
            {step === STEP_3 && 'Review the categories and products to be added. Categories will be created if they do not exist. Click Finish and Add.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {step === STEP_1 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No template categories found.</p>
              ) : (
                <ul className="border rounded-md divide-y max-h-[280px] overflow-y-auto">
                  {filteredCategories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <Checkbox
                        checked={selectedCategoryIds.has(cat.id)}
                        onCheckedChange={() => toggleCategory(cat.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="flex-1 font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">{cat.templates.length} product(s)</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleNextFromStep1}
                  disabled={selectedCategoryIds.size === 0 || templatesLoading}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {step === STEP_2 && (
            <>
              <Accordion type="multiple" className="w-full">
                {selectedCategories.map((cat) => {
                  const allSelected = cat.templates.every((t) => selectedTemplateIds.has(t.id));
                  return (
                    <AccordionItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) => {
                            if (checked) selectAllInCategory(cat);
                            else deselectAllInCategory(cat);
                          }}
                        />
                        <AccordionTrigger className="flex-1 hover:no-underline text-left">
                          <span>{cat.name}</span>
                          <span className="text-muted-foreground text-sm font-normal ml-1">
                            ({cat.templates.filter((t) => selectedTemplateIds.has(t.id)).length}/{cat.templates.length})
                          </span>
                        </AccordionTrigger>
                      </div>
                      <AccordionContent>
                        <ul className="pl-6 space-y-2">
                          {cat.templates.map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`tpl-${t.id}`}
                                checked={selectedTemplateIds.has(t.id)}
                                onCheckedChange={() => toggleTemplate(t.id)}
                              />
                              <label htmlFor={`tpl-${t.id}`} className="text-sm cursor-pointer flex-1">
                                {t.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Go Back
                </Button>
                <Button onClick={() => setStep(STEP_3)} disabled={totalSelectedCount === 0}>
                  Next
                </Button>
              </div>
            </>
          )}

          {step === STEP_3 && (
            <>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Categories and products to be added</p>
                <p className="text-xs text-muted-foreground">Total: {totalSelectedCount} product(s) in {selectedCategoriesWithProducts.length} categor{selectedCategoriesWithProducts.length === 1 ? 'y' : 'ies'}. Categories will be created if they do not exist.</p>
              </div>
              <div className="space-y-3">
                {selectedCategoriesWithProducts.map((cat) => {
                  const selectedTemplates = cat.templates.filter((t) => selectedTemplateIds.has(t.id));
                  const count = selectedTemplates.length;
                  return (
                    <div key={cat.id} className="flex flex-col gap-2 rounded-md border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{count} product(s)</p>
                      </div>
                      {selectedTemplates.length > 0 && (
                        <ul className="text-xs text-muted-foreground pl-2 border-l-2 border-muted space-y-0.5 mt-1">
                          {selectedTemplates.map((t) => (
                            <li key={t.id}>{t.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Products will be created with names like &quot;Template name - Your store name&quot;.
              </p>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Go Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={totalSelectedCount === 0 || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Finish and Add
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
