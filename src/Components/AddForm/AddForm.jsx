import React, { useState } from 'react';
import './AddForm.scss';

const AddForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    amount: '',
    customerName: '',
    productName: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(null);

  const paymentMethods = ['Cash', 'GCash', 'SeaBank', 'PayMaya'];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount is required and must be greater than 0';
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setShowError(null);

    try {
      const response = await fetch('http://localhost:3000/proxy/notion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }

      console.log('✅ Successfully saved to Notion:', result);
      
      // Call the parent onSubmit to update local state
      onSubmit(formData);
      setShowSuccess(true);
      
      // Reset form
      setFormData({
        amount: '',
        customerName: '',
        productName: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: ''
      });

      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error submitting form:', error);
      setShowError(error.message || 'Failed to save data. Please try again.');
      
      // Still update local state for better UX even if API fails
      onSubmit(formData);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      amount: '',
      customerName: '',
      productName: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: ''
    });
    setErrors({});
    setShowError(null);
  };

  return (
    <div className="earnings-form">
      <div className="earnings-form__wrapper">
        <div className="earnings-form__header">
          <h1>Add New Sale</h1>
          <button className="earnings-form__close" onClick={onClose} disabled={isSubmitting}>
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        {showSuccess && (
          <div className="success-notification">
            <span>✓ Sale added successfully!</span>
          </div>
        )}

        {showError && (
          <div className="error-notification">
            <span>⚠ {showError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-content">
          <div className="form-content__row">
            <div className="form-content__field">
              <label htmlFor="amount" className="form-content__label">
                Amount (₱)
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                className={`form-content__input ${errors.amount ? 'form-content__input--error' : ''}`}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isSubmitting}
              />
              {errors.amount && <span className="form-content__error">{errors.amount}</span>}
            </div>

            <div className="form-content__field">
              <label htmlFor="customerName" className="form-content__label">
                Customer Name
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className={`form-content__input ${errors.customerName ? 'form-content__input--error' : ''}`}
                placeholder="Enter customer name"
                disabled={isSubmitting}
              />
              {errors.customerName && <span className="form-content__error">{errors.customerName}</span>}
            </div>
          </div>

          <div className="form-content__row">
            <div className="form-content__field">
              <label htmlFor="productName" className="form-content__label">
                Product Name
              </label>
              <input
                type="text"
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={handleInputChange}
                className={`form-content__input ${errors.productName ? 'form-content__input--error' : ''}`}
                placeholder="Enter product name"
                disabled={isSubmitting}
              />
              {errors.productName && <span className="form-content__error">{errors.productName}</span>}
            </div>

            <div className="form-content__field">
              <label htmlFor="date" className="form-content__label">
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`form-content__input ${errors.date ? 'form-content__input--error' : ''}`}
                disabled={isSubmitting}
              />
              {errors.date && <span className="form-content__error">{errors.date}</span>}
            </div>
          </div>

          <div className="form-content__field form-content__field--full">
            <label htmlFor="paymentMethod" className="form-content__label">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              className={`form-content__input form-content__select ${errors.paymentMethod ? 'form-content__input--error' : ''}`}
              disabled={isSubmitting}
            >
              <option value="">Select payment method</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            {errors.paymentMethod && <span className="form-content__error">{errors.paymentMethod}</span>}
          </div>

          <div className="form-content__actions">
            <button
              type="button"
              onClick={handleReset}
              className="form-content__button form-content__button--secondary"
              disabled={isSubmitting}
            >
              Clear
            </button>
            <button
              type="submit"
              className="form-content__button form-content__button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddForm;