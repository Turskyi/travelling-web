import CountryEntry from '@/components/CountryEntry';
import useSWR from 'swr';
import * as CountryApi from '@/network/country-api';
import { Col, Row, Spinner, Button } from 'react-bootstrap';
import Image from 'next/image';

export default function Home() {
  const { data, isLoading } = useSWR(
    'v3.1/all?fields=name,maps,flags,coatOfArms,capital,flag,population,languages',
    CountryApi.getCountries,
  );

  if (isLoading)
    return <Spinner animation="border" className="d-block m-auto" />;

  return (
    <div style={{ padding: '20px' }}>
      <div
        className="disclaimer text-center mb-4 white-text"
        style={{
          fontSize: '1.25rem',
          fontFamily: 'Roboto, sans-serif',
          padding: '10px',
          backgroundColor: '#333',
          borderRadius: '8px',
        }}
      >
        <p>
          This website is currently in progress. In the meantime, you can
          download our Android applications:
        </p>
        <div className="flex flex-col items-center md:flex-row md:items-center">
          <span
            className="white-text"
            style={{ fontSize: '1.25rem', fontFamily: 'Roboto, sans-serif' }}
          >
            Download the Travelling Android application.
          </span>
          <a
            href="https://play.google.com/store/apps/details?id=ua.turskyi.travelling"
            target="_blank"
            className="ml-2"
          >
            <Image
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt="Get it on Google Play"
              width={240}
              height={80}
            />
          </a>
        </div>
        <div className="flex flex-col items-center md:flex-row md:items-center mb-2">
          <span
            className="white-text"
            style={{ fontSize: '1.25rem', fontFamily: 'Roboto, sans-serif' }}
          >
            Download the Travelling Pro Android application.
          </span>
          <a
            href="https://play.google.com/store/apps/details?id=io.github.turskyi.travellingpro"
            target="_blank"
            className="ml-2"
          >
            <Image
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt="Get it on Google Play"
              width={240}
              height={80}
            />
          </a>
        </div>
      </div>

      <div
        className="description text-center mb-4 white-text"
        style={{
          fontSize: '1.25rem',
          fontFamily: 'Roboto, sans-serif',
          padding: '10px',
          backgroundColor: '#333',
          borderRadius: '8px',
        }}
      >
        <p>
          <strong>
            The best way to motivate yourself to visit all countries in the
            world
          </strong>{' '}
          is to make a list of them and cross them out one by one until you
          visit all of them. For the sake of convenience, I have made a simple
          app for that.
        </p>
        <p>
          The idea of this app is not unique, but it is special in its
          simplicity and absence of useless functionality.
        </p>
        <p>
          The Travelling Pro app is not free, since it uses payable Google
          storage for storing your uploaded photos and data. On the bright side,
          your saved countries are accessible throughout all platforms. In
          addition, you can see all other users of this app, who allowed to be
          visible, and see how many countries they have visited.
        </p>
        <p>
          <strong>Enjoy Travelling.</strong>
        </p>
      </div>

      <h1 className="text-center mb-4 white-text">Gotta visit &apos;em all</h1>

      <Row xs={1} sm={2} lg={3} xl={4} className="g-4">
        {data?.map((countryEntry) => (
          <Col key={countryEntry.name.official}>
            <CountryEntry name={countryEntry.name.official} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
