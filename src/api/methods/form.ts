// src/api/methods/form.ts

import { forms, generateUniqueId } from '../../utils'; // Import mock data and utility
import { FormData } from '../../types'; // Import FormData interface

/**
 * JSON-RPC method for submitting structured form data.
 * @param {object} params - The parameters for the method.
 * @param {object} params.formData - The form data to submit.
 * @returns {{message: string, formId: string}} - Success message and new form ID.
 * @throws {Error} - If no form data is provided.
 */
export const submit = (params: { formData: FormData }) => {
  const { formData } = params;
  if (!formData || Object.keys(formData).length === 0) {
    throw new Error('No form data provided.');
  }

  const formId = generateUniqueId();
  forms.push({ id: formId, ...formData, timestamp: new Date().toISOString() });
  console.log(`Form submitted: ${JSON.stringify(formData)}`);
  return { message: 'Form submitted successfully (mock)!', formId };
};
