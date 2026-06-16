import React from 'react';
import { Heading, Text, Box } from '@radix-ui/themes';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { notFound } from 'next/navigation';

export default function TermsPage() {
  // Check if terms page should be accessible
  const showTermsPage = process.env.NEXT_PUBLIC_REQUIRE_TERMS_ACCEPTANCE === 'true';
  
  // If terms are not required, show 404
  if (!showTermsPage) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Login
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-none md:shadow-lg p-4 md:p-8 md:rounded-none">
          <Heading as="h1" size="6" weight="bold" className="mb-4 md:mb-6 text-gray-900 md:text-4xl">
            Futurepath.ai Terms and Conditions of Use
          </Heading>
          
          <Text size="2" className="mb-6 md:mb-8 text-gray-600">
            Effective Date: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>

          <div className="prose prose-gray max-w-none">
            <Text size="2" className="mb-4 md:mb-6 text-gray-700">
              By accessing or using any Futurepath.ai ("Company," "we," "us," or "our") platform, service, application, or system (collectively, the "Environment"), you ("User," "you," or "your") agree to comply with and be bound by the following Terms and Conditions ("T&C"). If you do not agree to these T&C, you are not authorized to access or use the Environment.
            </Text>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                1. Access and Eligibility
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>Access to the Environment is granted solely for authorized purposes.</li>
                <li>You must provide accurate and complete information to obtain login credentials.</li>
                <li>We reserve the right to revoke access at any time without notice.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                2. Ownership and Intellectual Property
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>The Environment and all content, software, code, designs, data, features, user interfaces, documentation, graphics, logos, trademarks, and all other materials therein (collectively, the "Materials") are the exclusive property of Futurepath.ai and are protected under United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.</li>
                <li>No license or other rights, express or implied, are granted to you except as explicitly stated in these T&C.</li>
                <li>You may not copy, reproduce, distribute, transmit, display, sell, sublicense, or otherwise exploit any Materials for commercial purposes without the express prior written consent of Futurepath.ai.</li>
                <li>All rights not expressly granted herein are reserved by Futurepath.ai.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                3. Restrictions on Use
              </Heading>
              <Text size="2" className="mb-3 md:mb-4 text-gray-700">
                By accessing the Environment, you agree not to:
              </Text>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code or underlying structure of the Environment.</li>
                <li>Copy, reproduce, modify, distribute, publicly display, or create derivative works of the Environment.</li>
                <li>Use the Environment to build or develop products or services competitive with Futurepath.ai.</li>
                <li>Share your login credentials with any third party.</li>
                <li>Remove, obscure, or alter any copyright, trademark, or other proprietary notices contained in the Environment.</li>
                <li>Use the Environment in any manner that could damage, disable, or impair its operation or interfere with any other party's use.</li>
              </ul>

              <Heading as="h3" size="3" weight="bold" className="mb-2 md:mb-3 mt-4 md:mt-6 text-gray-900">
                3.7 Prohibited Activities and Security
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>You may not use the Environment to scrape data, run automated scripts or bots without prior written consent, introduce malware, or otherwise compromise the security, integrity, or performance of the Environment.</li>
                <li>You agree to comply with all security and access protocols provided by Futurepath.ai.</li>
              </ul>

              <Heading as="h3" size="3" weight="bold" className="mb-2 md:mb-3 mt-4 md:mt-6 text-gray-900">
                3.8 Intellectual Property Protection and Data Extraction
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>You may not capture, record, or take screenshots, photos, or screen recordings of the Environment or any Materials for any purpose, including personal use, without prior written consent from Futurepath.ai.</li>
                <li>You may not use any automated tools, scripts, bots, web crawlers, or other means to copy, extract, aggregate, or collect data or content from the Environment.</li>
                <li>You may not circumvent or attempt to bypass any security, authentication, or access control mechanisms implemented by Futurepath.ai.</li>
                <li>You may not exploit the Environment or any Materials for commercial purposes, research, benchmarking, competitive analysis, or any other use without express prior written consent.</li>
                <li>Any violation of these clauses may result in immediate termination of access and may expose you to civil or criminal liability under applicable intellectual property and computer security laws.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                4. Confidentiality
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>The Environment may contain confidential and proprietary information. You agree to maintain its confidentiality and not disclose any information to any third party without our prior written consent.</li>
                <li>You agree to implement reasonable safeguards to prevent unauthorized access, use, or disclosure of the Environment or any Materials therein.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                5. Tracking and Monitoring
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>Access to the Environment may be logged and monitored.</li>
                <li>By using the Environment, you consent to such monitoring and agree that Futurepath.ai may track usage to ensure compliance with these T&C.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                6. No Warranties
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>The Environment is provided "as-is" and "as available" without any warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</li>
                <li>Futurepath.ai does not guarantee that access will be uninterrupted, error-free, or secure.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                7. Limitation of Liability
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>To the maximum extent permitted by law, Futurepath.ai shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or use arising out of or in connection with your use of the Environment.</li>
                <li>You assume all risk associated with your use of the Environment.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                8. Indemnification
              </Heading>
              <Text size="2" className="text-gray-700">
                You agree to indemnify, defend, and hold harmless Futurepath.ai, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising from your use of the Environment or violation of these T&C.
              </Text>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                9. Termination
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>Futurepath.ai may terminate or suspend your access at any time for any reason, including violation of these T&C.</li>
                <li>Upon termination, you must immediately cease all use of the Environment and destroy any Materials in your possession.</li>
              </ul>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                10. Governing Law
              </Heading>
              <Text size="2" className="text-gray-700">
                These T&C shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law principles. Any disputes arising under these T&C shall be resolved exclusively in the state or federal courts located in San Francisco County, California.
              </Text>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                11. Severability
              </Heading>
              <Text size="2" className="text-gray-700">
                If any provision of these T&C is found to be unenforceable, the remaining provisions shall continue in full force and effect.
              </Text>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                12. Entire Agreement
              </Heading>
              <Text size="2" className="text-gray-700">
                These T&C constitute the entire agreement between you and Futurepath.ai regarding the Environment and supersede any prior or contemporaneous agreements, understandings, or communications.
              </Text>
            </section>

            <section className="mb-6 md:mb-8">
              <Heading as="h2" size="4" weight="bold" className="mb-3 md:mb-4 text-gray-900">
                13. Client Presentations and Partnership Acknowledgment
              </Heading>
              <ul className="list-disc pl-4 md:pl-6 space-y-1 md:space-y-2 text-sm md:text-base text-gray-700">
                <li>If you use the Environment to present, demonstrate, or showcase features to your clients, customers, or any third party, you agree that you are acting as a partner of Futurepath.ai for that purpose.</li>
                <li>You acknowledge that any representation or discussion regarding the Environment must accurately reflect Futurepath.ai's products, services, and intellectual property.</li>
                <li>You agree that for any client to whom you present the Environment, you are partnering with Futurepath.ai for that particular client.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}