const fs = require('fs');

let content = fs.readFileSync('src/app/catalogue/page.tsx', 'utf8');

const startStr = "  const handleCategorySubmit = async (";
const endStr = "  const handleDeleteCategory = async (id: string | number) => {";

const replacement = `  const handleCategorySubmit = async (
    values: z.infer<typeof categorySchema>
  ) => {
    if (categorySubmitRef.current || isCreatingCategory || isUpdatingCategory)
      return;
    categorySubmitRef.current = true;
    try {
      if (editingCategory && editingCategory.id) {
        await updateCategory(String(editingCategory.id), values);
        feedback.success(
          "Category updated",
          "Category updated successfully."
        );
      } else {
        const nameLower = (values.name ?? "").toString().trim().toLowerCase();
        const categoryExists = (typedCategories ?? []).some(
          (c: ApiCategory) =>
            (c.name ?? "").toString().trim().toLowerCase() === nameLower
        );
        if (categoryExists) {
          setDuplicateNameModal({ type: "category" });
          return;
        }
        await createCategory(values);
        feedback.success("Category added", "Category added successfully.");
      }
      setCategoryDialogOpen(false);
      categoryForm.reset();
    } catch (error: unknown) {
      console.error("Failed to save category:", error);
      feedback.fromError(
        error,
        "Failed to save category",
        "Check your connection and try again."
      );
    } finally {
      categorySubmitRef.current = false;
    }
  };

  const handleDeleteCategory = async (id: string | number) => {
    setDeletingCategoryId(String(id));
    try {
      await deleteCategoryHook(String(id));
      feedback.success("Category deleted", "Category deleted successfully.");
    } catch (error) {
      feedback.fromError(
        error,
        "Failed to delete category",
        "Try again or check your connection."
      );
    } finally {
      setDeletingCategoryId(null);
    }
  };`;

// We need to find the start index of handleCategorySubmit
const startIndex = content.indexOf(startStr);
// We need to find the end index of handleDeleteCategory
const handleDeleteStartIndex = content.indexOf(endStr, startIndex);
// We need to find the end of handleDeleteCategory which ends right before "  return ("
const nextFuncStartIndex = content.indexOf("  return (", handleDeleteStartIndex);

if (startIndex !== -1 && nextFuncStartIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n\n' + content.substring(nextFuncStartIndex);
  fs.writeFileSync('src/app/catalogue/page.tsx', content);
  console.log("Successfully replaced");
} else {
  console.log("Could not find start or end index");
}
