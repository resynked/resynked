import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Link from 'next/link';
import Select from '@/components/Select';
import { Search, X } from 'lucide-react';
import type { Customer, Product } from '@/lib/supabase';

export default function NewInvoice() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer_id: '',
    currency: 'EUR',
    items: [] as { product_id: string; product_name: string; description: string; quantity: number; price: number }[],
    tax_percentage: 21,
    discount_percentage: 0,
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    generateInvoiceNumber();
  }, []);

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900) + 100;
    setFormData(prev => ({ ...prev, invoice_number: `${year}.${random}` }));
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, customer_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addProduct = (product: Product) => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_id: String(product.id),
          product_name: product.name,
          description: product.description || '',
          quantity: 1,
          price: product.price
        },
      ],
    });
    setSearchTerm('');
    setShowProductSearch(false);
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const calculateDiscount = () => {
    return (calculateSubtotal() * formData.discount_percentage) / 100;
  };

  const calculateTax = () => {
    return ((calculateSubtotal() - calculateDiscount()) * formData.tax_percentage) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const selectedCustomer = customers.find(c => c.id === formData.customer_id);

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.name,
  })) || [];

  const currencyOptions = [
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'GBP', label: 'GBP (£)' },
  ];

  const taxOptions = [
    { value: '0', label: '0%' },
    { value: '9', label: '9%' },
    { value: '21', label: '21%' },
  ];

  const discountOptions = [
    { value: '0', label: '0%' },
    { value: '5', label: '5%' },
    { value: '10', label: '10%' },
    { value: '15', label: '15%' },
    { value: '20', label: '20%' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const total = calculateTotal();

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          customer_id: formData.customer_id,
          currency: formData.currency,
          tax_percentage: formData.tax_percentage,
          discount_percentage: formData.discount_percentage,
          status: 'draft',
          total,
          items: formData.items,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/invoices');
    } catch (err) {
      setError('Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="header">
        <h1>Nieuwe factuur aanmaken</h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.push('/invoices')}>
            Annuleren
          </button>
          <button type="submit" form="invoice-form" className="button" disabled={isLoading || formData.items.length === 0}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        {/* Left Side - Form */}
        <div className="block">
          <form id="invoice-form" onSubmit={handleSubmit}>
            {/* Layout Tabs */}
            <div className="tabs">
              <a
                href="#layout"
                className="tab active"
                onClick={(e) => e.preventDefault()} // voorkomt dat de pagina scrollt
              >
                Algemeen
              </a>
              <a
                href="#algemeen"
                className="tab"
                onClick={(e) => e.preventDefault()}
              >
                Notities
              </a>
              <a
                href="#versturen"
                className="tab"
                onClick={(e) => e.preventDefault()}
              >
                Versturen
              </a>
            </div>


            {/* Invoice Details */}
            <div className="form-section">
              <div className="form-group">
                <input
                  id="invoice_number"
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Factuurnummer"
                  required
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="invoice_date">Factuurdatum</label>
                  <input
                    id="invoice_date"
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="due_date">Vervaldatum</label>
                  <input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Customer Selection */}
            <div className="form-section">
              <h3>Klantgegevens</h3>
              <div className="form-group">
                <Select
                  value={customerOptions.find(o => o.value === formData.customer_id) || null}
                  onChange={(option) => setFormData({ ...formData, customer_id: option?.value || '' })}
                  options={customerOptions}
                  placeholder="Selecteer klant..."
                />
              </div>
            </div>

            {/* Products */}
            <div className="form-section">
              <h3>Artikelgegevens</h3>

              <div className="form-group">
                <label>Valuta</label>
                <Select
                  value={currencyOptions.find(o => o.value === formData.currency) || null}
                  onChange={(option) => setFormData({ ...formData, currency: option?.value || 'EUR' })}
                  options={currencyOptions}
                />
              </div>

              {/* Product Search */}
              <div className="product-search-container">
                <div className="product-search-input">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Zoek en voeg artikelen toe..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductSearch(e.target.value.length > 0);
                    }}
                    onFocus={() => searchTerm && setShowProductSearch(true)}
                  />
                </div>

                {showProductSearch && filteredProducts.length > 0 && (
                  <div className="product-search-results">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="product-search-item"
                        onClick={() => addProduct(product)}
                      >
                        <div className="product-search-info">
                          <div className="product-search-name">{product.name}</div>
                          <div className="product-search-desc">{product.description}</div>
                        </div>
                        <div className="product-search-price">€{product.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Items */}
              {formData.items.map((item, index) => (
                <div key={index} className="form-section">
                  <div className="form-row invoice-product-line">
                  
                  <div className="form-group">
                    <input
                      type="text"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      placeholder="Product naam"
                    />
                  </div>

                <div className="form-group">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                      placeholder="Aantal"
                      className="center-input"
                    />
                </div>

                  <Link className="action delete" href=""
                      onClick={() => removeItem(index)}
                    >
                      <X size={16} />
                    </Link>

           
                  </div>
                </div>
              ))}

              <button type="button" className="button add-item" onClick={() => setShowProductSearch(true)}>
                + Artikel toevoegen
              </button>
            </div>

            {/* Tax & Discount */}
            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tax">BTW percentage</label>
                  <Select
                    value={taxOptions.find(o => o.value === String(formData.tax_percentage)) || null}
                    onChange={(option) => setFormData({ ...formData, tax_percentage: option?.value ? Number(option.value) : 21 })}
                    options={taxOptions}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discount">Kortingspercentage</label>
                  <Select
                    value={discountOptions.find(o => o.value === String(formData.discount_percentage)) || null}
                    onChange={(option) => setFormData({ ...formData, discount_percentage: option?.value ? Number(option.value) : 0 })}
                    options={discountOptions}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right Side - Preview */}
        <div className="block">
          <div className="invoice-preview">
            {/* Company Header */}
            <div className="invoice-company-header">
              <div className="invoice-company-logo">Bedrijfslogo</div>
              <div className="invoice-company-info">
                <div>Uw bedrijfsnaam</div>
                <div>Straatnaam 1</div>
                <div>1200 AC Amsterdam</div>
         
                  <div>KvK: 12345678</div>
                  <div>BTW: NL123456789B01:17</div>
                  <div>Bank: NL55 BANK 0123 4567 89</div>
                
              </div>
            </div>

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="invoice-customer-info">
                <div>{selectedCustomer.name}</div>
                {selectedCustomer.address && (
                  <>
                    {selectedCustomer.address.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Invoice Title */}
            <h1 className="invoice-title">Factuur</h1>

            {/* Invoice Meta */}
            {formData.invoice_number && (
              <div className="invoice-data">
                {formData.invoice_number && <div>Factuurnummer: {formData.invoice_number}</div>}
                {formData.invoice_date && <div>Factuurdatum: {new Date(formData.invoice_date).toLocaleDateString('nl-NL')}</div>}
                {formData.due_date && <div>Vervaldatum: {new Date(formData.due_date).toLocaleDateString('nl-NL')}</div>}
              </div>
            )}

            {/* Invoice Table */}
            {formData.items.length > 0 && (
              <div className="table-container">
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Artikelnummer</th>
                      <th>Omschrijving</th>
                      <th>Aantal</th>
                      <th>Prijs per stuk</th>
                      <th>Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.product_id.slice(0, 8)}</td>
                        <td>
                          {item.product_name}
                          {item.description && <div className="invoice-table-desc">{item.description}</div>}
                        </td>
                        <td>{item.quantity}</td>
                        <td>€ {item.price.toFixed(2)}</td>
                        <td>€ {(item.quantity * item.price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            {formData.items.length > 0 && (
              <div className="invoice-total">
                <div className="invoice-total-row">
                  <span>Subtotaal</span>
                  <span>€ {calculateSubtotal().toFixed(2)}</span>
                </div>
                {formData.discount_percentage > 0 && (
                  <div className="invoice-total-row">
                    <span>Korting ({formData.discount_percentage}%)</span>
                    <span>- € {calculateDiscount().toFixed(2)}</span>
                  </div>
                )}
                <div className="invoice-total-row">
                  <span>BTW ({formData.tax_percentage}%)</span>
                  <span>€ {calculateTax().toFixed(2)}</span>
                </div>
                <div className="invoice-total-row total-final">
                  <span>Totaal</span>
                  <span>€ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
