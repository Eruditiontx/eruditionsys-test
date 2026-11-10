import '@/styles/globals.css';
import clsx from 'clsx';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { headers } from 'next/headers';
import Header from './Header';
import { Providers } from './providers';
import { LocaleCodeType } from '@/types/locale';
import { fontSans } from '@/config/fonts';
import Config from '@/config/config';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const headersList = headers();
  const host = headersList.get('host');
  const isOfficialDomain = host === 'unittcms.org' || host === 'odoo.eruditionsys.com';
  const t = await getTranslations({ locale, namespace: 'Header' });

  return {
    title: `${t('title')} | EruditionSys TCMS`,
    description: t('description'),
    icons: {
      icon: `${Config.basePath}/favicon/favicon.ico`,
      shortcut: `${Config.basePath}/favicon/favicon-16x16.png`,
      apple: `${Config.basePath}/favicon/apple-touch-icon.png`,
    },
    alternates: {
      canonical: `https://odoo.eruditionsys.com/test/${locale}`,
    },
    robots: isOfficialDomain ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: LocaleCodeType };
}) {
  const t = useTranslations('Toast');
  const toastMessages = {
    needSignedIn: t('need_signed_in'),
    sessionExpired: t('session_expired'),
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body className={clsx('min-h-[calc(100vh-64px)] bg-background font-sans antialiased', fontSans.variable)}>
        <Providers
          themeProps={{ attribute: 'class', defaultTheme: 'light' }}
          tokenProps={{ toastMessages: toastMessages, locale: locale }}
        >
          <div className="relative flex flex-col min-h-screen light:bg-neutral-50 dark:bg-neutral-800">
            <Header locale={locale} />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
