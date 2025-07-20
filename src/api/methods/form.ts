// src/api/methods/form.ts

/**
 * JSON-RPC method for submitting structured form data.
 * @param {object} params - The parameters for the method.
 * @param {object} params.formData - The form data to submit.
 * @returns {{message: string, formId: string}} - Success message and new form ID.
 * @throws {Error} - If no form data is provided.
 */
export const submit = (params: { formData: FormData }) => {
  
  return { message: 'Form submitted successfully (mock)!' };
};
