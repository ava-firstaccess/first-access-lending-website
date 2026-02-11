export default function Footer() {
  return (
    <>
      {/* Contact Section */}
      <section id="contact" className="bg-[#003961] text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Unlock Your Access?</h2>
          <p className="text-xl text-[#0EF0F0] mb-8">
            Get started today or reach out directly. We're here to help.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <a 
              href="mailto:info@firstaccesslending.com"
              className="bg-white text-[#003961] px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] hover:scale-105 transition-all"
            >
              📧 Email Us
            </a>
            <a 
              href="tel:+1234567890"
              className="bg-[#0283DB] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#0EF0F0] hover:text-[#003961] hover:scale-105 transition-all"
            >
              📞 Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Footer - NMLS Info */}
      <footer className="bg-[#000C14] text-gray-400 py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <p className="mb-2">© 2026 First Access Lending. All rights reserved.</p>
            <p className="text-sm mb-2">
              <strong className="text-white">NMLS #1988098</strong> | Equal Housing Lender
            </p>
            <p className="text-xs max-w-3xl mx-auto">
              First Access Lending is a division of East Coast Capital Corp. Licensed by the Virginia State Corporation 
              Commission MC-6961. Loans made or arranged pursuant to Department of Financial Protection and Innovation 
              California Financing Law License.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
