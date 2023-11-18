import Head from 'next/head'
import 'bootstrap/dist/css/bootstrap.min.css';
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Indie_Flower } from 'next/font/google'
import { Container } from 'react-bootstrap';

const indieFlowerFont = Indie_Flower({ subsets: ['latin'], weight: ['400'], })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
        <Head>
        <title>Travelling</title>
        <meta name="description" content="A web application to help collect all countries that you have visited." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={indieFlowerFont.className}>
      <main>
        <Container className='py-4'>
          <Component {...pageProps} />
        </Container>
      </main>
    </div>
    </>
  );
}
