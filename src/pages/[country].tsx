import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Button, Form, Spinner } from "react-bootstrap";
import Image from "next/image";
import useCountry from "@/hooks/useCountry";

export default function CountryDetailsPage() {
    const router = useRouter();
    const countryName = router.query.country?.toString() || '';
    const { country, countryLoading } = useCountry(countryName);
    return (
        <>
            <Head>
                {country && <title>{`${country.name.official}`}</title>}
            </Head>
            <div className='d-flex flex-column align-items-center'>
                <p className="text-white fs-3"><Link href="/" className="link-light">← Back.</Link></p>
                {countryLoading && <Spinner animation='grow' />}
                {country === null && <p className="text-white fs-1">Country not found</p>}
                {country &&
                    <>
                        <h1 className="text-center text-capitalize text-white" style={{fontSize: "60px"}}>{country.name.official}</h1>
                        <Image
                            src={country.flags.svg}
                            alt={'Country: ' + country.name.official}
                            width={500}
                            height={300}
                        />
                        <div className="d-inline-block mt-2 text-white fs-2">
                            <div><strong>Capital:</strong> {country.capital.join(', ')}</div>
                            <div><strong>Population:</strong> {country.population.toLocaleString()}</div>
                            <div><strong>Location: </strong><Link href={country.maps.googleMaps} className="link-light">{country.maps.googleMaps}</Link></div>
                        </div>
                    </>
                }
            </div>
        </>
    );
}