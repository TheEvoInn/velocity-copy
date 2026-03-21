import React from 'react';

export default function LivePreview({ storefront, branding, layout }) {
  const bgGradient = `linear-gradient(135deg, ${branding.primaryColor}20, ${branding.secondaryColor}20)`;
  const primaryColor = branding.primaryColor || '#06b6d4';
  const secondaryColor = branding.secondaryColor || '#7c3aed';
  const fontFamily = branding.fontFamily === 'serif' ? 'Georgia, serif' : 'Inter, sans-serif';

  return (
    <div 
      className="h-full overflow-auto bg-white rounded-lg border border-slate-200"
      style={{ fontFamily }}
    >
      {/* Hero Section */}
      <div 
        className="relative py-16 px-6"
        style={{ background: bgGradient }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            className="text-4xl font-bold mb-4"
            style={{ color: primaryColor }}
          >
            {storefront.headline || 'Your Product Title'}
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            {storefront.subheading || 'Compelling value proposition goes here'}
          </p>
          <button 
            className="px-8 py-3 rounded-lg font-semibold text-white transition-transform hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            {storefront.call_to_action || 'Get Access Now'}
          </button>
        </div>
      </div>

      {/* Product Description */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryColor }}>
          What You Get
        </h2>
        <p className="text-gray-700 leading-relaxed mb-8">
          {storefront.description || 'Product description and benefits go here'}
        </p>
      </div>

      {/* Features Grid */}
      {layout.showFeatures && (
        <div 
          className="max-w-4xl mx-auto px-6 py-12"
          style={{ background: `${secondaryColor}05` }}
        >
          <h2 className="text-2xl font-bold mb-8" style={{ color: primaryColor }}>
            Key Features
          </h2>
          <div className={`grid gap-6 ${layout.featureColumns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {storefront.features?.slice(0, layout.featureCount || 6).map((feature, idx) => (
              <div key={idx} className="p-6 bg-white rounded-lg border border-slate-200">
                <div 
                  className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  ✓
                </div>
                <h3 className="font-semibold mb-2" style={{ color: primaryColor }}>
                  {feature}
                </h3>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testimonial */}
      {layout.showTestimonial && (
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: primaryColor }}>
            What Customers Say
          </h2>
          <div className="bg-slate-100 rounded-lg p-8 border-l-4" style={{ borderColor: primaryColor }}>
            <p className="text-gray-700 italic mb-4">
              "{storefront.testimonial || 'Customer testimonial goes here'}"
            </p>
            <p className="font-semibold" style={{ color: primaryColor }}>— Happy Customer</p>
          </div>
        </div>
      )}

      {/* FAQ */}
      {layout.showFAQ && (
        <div 
          className="max-w-4xl mx-auto px-6 py-12"
          style={{ background: `${secondaryColor}05` }}
        >
          <h2 className="text-2xl font-bold mb-8" style={{ color: primaryColor }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {storefront.faq?.slice(0, 3).map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg p-6 border border-slate-200">
                <h3 className="font-semibold mb-2" style={{ color: primaryColor }}>
                  {item.question}
                </h3>
                <p className="text-gray-600 text-sm">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Footer */}
      <div 
        className="py-12 px-6 text-center"
        style={{ background: bgGradient }}
      >
        <p className="text-gray-700 mb-4">Ready to get started?</p>
        <button 
          className="px-8 py-3 rounded-lg font-semibold text-white transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor }}
        >
          {storefront.call_to_action || 'Get Access Now'}
        </button>
      </div>
    </div>
  );
}