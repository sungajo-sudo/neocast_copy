import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import watercolorBg from '../assets/images/watercolor-bg.png';
import featureEducation from '../assets/images/feature-education.png';
import featureCollaboration from '../assets/images/feature-collaboration.png';
import featureProcessAnalysis from '../assets/images/feature-process-analysis.png';
import featureInviteSystem from '../assets/images/feature-invite-system.png';
import featureSecurity from '../assets/images/feature-security.png';
import ncodeConcept from '../assets/images/ncode-concept.png';
import { useAuthStore } from '../stores/auth-store';
// Note: reusing existing assets or CSS for audience icons to keep it cleaner,
// using the generated set as a fallback or background if needed, but for now
// I will implement Audience using specific icons/content.
// Actually, I will crop/use the generated audience set if possible or just use emojis/SVG for the cards
// to be safer and cleaner as requested in plan.
// Let's import the specific images I generated.
// Note: target-audience.png is available but not currently used as individual icons are preferred
import techNcode from '../assets/images/tech-ncode.png';
import techSmartpen from '../assets/images/tech-smartpen.png';
import techPaperhub from '../assets/images/tech-paperhub.png';
import techPod from '../assets/images/tech-pod.png';

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isGuest } = useAuthStore();

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans">
      {/* Background with texture overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${watercolorBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-white/40 pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="py-6 flex justify-between items-center">
          <div className="flex items-center">
            {/* Logo removed as requested - using global header */}
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 rounded-full bg-white/80 hover:bg-white text-gray-800 font-medium shadow-sm backdrop-blur-sm transition-all border border-purple-100 hover:shadow-md"
            >
              {t('common.login')}
            </button>
          )}
        </header>

        {/* Hero Section */}
        <main className="mt-16 sm:mt-24 text-center pb-24">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-8 drop-shadow-sm">
            {t('landing.heroTitle')}<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent opacity-90">{t('landing.heroSubtitle')}</span>
          </h1>

          <p className="max-w-2xl mx-auto text-xl text-gray-700 mb-12 leading-relaxed">
            {t('landing.heroDescription')}
          </p>

          <button
            onClick={() => navigate(isAuthenticated && !isGuest ? '/host' : isAuthenticated ? '/lobby' : '/login')}
            className="group relative inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-white transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 overflow-hidden"
          >
            <span className="relative z-10">{t('landing.getStarted')}</span>
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-purple-600 to-blue-500" />
          </button>
        </main>

        {/* Features Grid */}
        <section className="py-20 mb-20 space-y-20">

          {/* New Section 0: Ncode Concept & AI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-1 transform hover:scale-105 transition-transform duration-500">
              <img
                src={ncodeConcept}
                alt="Ncode Concept"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl hover:rotate-1 transition-transform duration-500 border-4 border-white"
              />
            </div>
            <div className="order-2 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mb-2">
                New Feature
              </span>
              <h3 className="text-3xl font-bold text-gray-900">
                {t('landing.newConcept.title')}<br />
                <span className="text-blue-600">{t('landing.newConcept.subtitle')}</span>
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.newConcept.description')}
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="font-medium">{t('landing.newConcept.feature1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </span>
                  <span className="font-medium">{t('landing.newConcept.feature2')}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 1: Education & Connection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-2 md:order-1 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900">
                {t('landing.section1Title')}<br />{t('landing.section1Subtitle')}
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.section1Description')}
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  {t('landing.feature1')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  {t('landing.feature2')}
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2 transform hover:scale-105 transition-transform duration-500">
              <img
                src={featureEducation}
                alt="Remote Education"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
          </div>

          {/* Feature 2: Multi-Input & Creativity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-1 transform hover:scale-105 transition-transform duration-500">
              <img
                src={featureCollaboration}
                alt="Creative Collaboration"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl -rotate-2 hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
            <div className="order-2 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900">
                {t('landing.section2Title')}<br />{t('landing.section2Subtitle')}
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.section2Description')}
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  {t('landing.feature3')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                  {t('landing.feature4')}
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3: Process Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-2 md:order-1 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900">
                {t('landing.section3Title')}<br />{t('landing.section3Subtitle')}
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.section3Description')}
              </p>
            </div>
            <div className="order-1 md:order-2 transform hover:scale-105 transition-transform duration-500">
              <img
                src={featureProcessAnalysis}
                alt="Process Sharing and Analysis"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl rotate-1 hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
          </div>

          {/* Feature 4: Invitation System */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-1 transform hover:scale-105 transition-transform duration-500">
              <img
                src={featureInviteSystem}
                alt="Easy Invitation System"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl -rotate-1 hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
            <div className="order-2 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900">
                {t('landing.section4Title')}<br />{t('landing.section4Subtitle')}
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.section4Description')}
              </p>
            </div>
          </div>

          {/* Feature 5: Security */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-2 md:order-1 space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900">
                {t('landing.section5Title')}<br />{t('landing.section5Subtitle')}
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('landing.section5Description')}
              </p>
            </div>
            <div className="order-1 md:order-2 transform hover:scale-105 transition-transform duration-500">
              <img
                src={featureSecurity}
                alt="Security and Privacy"
                className="w-4/5 mx-auto h-auto rounded-3xl shadow-2xl rotate-1 hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
          </div>

          {/* New Section: Target Audience */}
          <div className="space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                {t('landing.targetAudience.title')} <span className="text-purple-600">{t('landing.targetAudience.subtitle')}</span>
              </h2>
              <p className="text-gray-600 text-lg">
                {t('landing.targetAudience.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Educator */}
              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 text-green-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{t('landing.targetAudience.educator.title')}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{t('landing.targetAudience.educator.description')}</p>
              </div>

              {/* Card 2: Tutor */}
              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{t('landing.targetAudience.tutor.title')}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{t('landing.targetAudience.tutor.description')}</p>
              </div>

              {/* Card 3: Consultant */}
              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 text-purple-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{t('landing.targetAudience.consultant.title')}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{t('landing.targetAudience.consultant.description')}</p>
              </div>

              {/* Card 4: Counselor */}
              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-4 text-pink-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{t('landing.targetAudience.counselor.title')}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{t('landing.targetAudience.counselor.description')}</p>
              </div>
            </div>
          </div>

          {/* New Section: Technology Stack */}
          <div className="space-y-16">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                {t('landing.technology.title')} <span className="text-blue-600">{t('landing.technology.subtitle')}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              {/* Tech 1: Ncode */}
              <div className="group bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-white/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="h-64 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10" />
                  <img src={techNcode} alt="Ncode Technology" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-6 z-20">
                    <span className="text-blue-300 font-semibold tracking-wider text-sm uppercase mb-1 block">{t('landing.technology.ncode.concept')}</span>
                    <h3 className="text-2xl font-bold text-white">{t('landing.technology.ncode.title')}</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {t('landing.technology.ncode.description')}
                  </p>
                </div>
              </div>

              {/* Tech 2: Smartpen */}
              <div className="group bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-white/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="h-64 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10" />
                  <img src={techSmartpen} alt="Smartpen Technology" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-6 z-20">
                    <span className="text-blue-300 font-semibold tracking-wider text-sm uppercase mb-1 block">{t('landing.technology.smartpen.concept')}</span>
                    <h3 className="text-2xl font-bold text-white">{t('landing.technology.smartpen.title')}</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {t('landing.technology.smartpen.description')}
                  </p>
                </div>
              </div>

              {/* Tech 3: PaperHub */}
              <div className="group bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-white/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="h-64 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10" />
                  <img src={techPaperhub} alt="PaperHub Technology" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-6 z-20">
                    <span className="text-blue-300 font-semibold tracking-wider text-sm uppercase mb-1 block">{t('landing.technology.paperhub.concept')}</span>
                    <h3 className="text-2xl font-bold text-white">{t('landing.technology.paperhub.title')}</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {t('landing.technology.paperhub.description')}
                  </p>
                </div>
              </div>

              {/* Tech 4: POD */}
              <div className="group bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-white/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="h-64 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10" />
                  <img src={techPod} alt="POD Technology" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-6 z-20">
                    <span className="text-blue-300 font-semibold tracking-wider text-sm uppercase mb-1 block">{t('landing.technology.pod.concept')}</span>
                    <h3 className="text-2xl font-bold text-white">{t('landing.technology.pod.title')}</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {t('landing.technology.pod.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Company Footer Info (Before Global Footer) */}
          <div className="relative py-16 px-8 bg-gradient-to-br from-gray-900 to-blue-900 rounded-3xl shadow-2xl overflow-hidden text-center">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat" />
            <div className="relative z-10 max-w-4xl mx-auto space-y-6">
              <div className="inline-block px-4 py-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 backdrop-blur-sm text-yellow-300 font-bold tracking-wide text-sm mb-2">
                GLOBAL LEADER
              </div>
              <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {t('landing.technology.footer.company')}
              </h3>
              <p className="text-lg md:text-xl text-blue-100/80 leading-relaxed max-w-2xl mx-auto">
                {t('landing.technology.footer.description')}
              </p>
            </div>
          </div>

        </section>

        {/* Footer info */}
        <footer className="py-12 text-center border-t border-gray-200/50 backdrop-blur-sm bg-white/30 rounded-t-3xl">
          <p className="text-gray-600 font-medium mb-2">{t('common.copyright')}</p>
          <a
            href="https://www.neolab.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-purple-600 transition-colors font-medium hover:underline"
          >
            www.neolab.net
          </a>
        </footer>

      </div>
    </div>
  );
}
