import CountryEntry from "@/components/CountryEntry";
import Link from "next/link";
import useSWR from "swr";
import * as CountryApi from "@/network/country-api";
import { Col, Row, Spinner } from "react-bootstrap";

export default function Home() {
  const { data, isLoading } = useSWR('v3.1/all?fields=name,maps,flags,coatOfArms,capital,flag,population,languages', CountryApi.getCountries);

  if (isLoading) return <Spinner animation="border" className="d-block m-auto" />
  return (
    <div>
      <h1 className='text-center mb-4 white-text'>Gotta visit &apos;em all</h1>
      <Row xs={1} sm={2} lg={3} xl={4} className="g-4">
        {data?.map(countryEntry => (
          <Col key={countryEntry.name.official}>
            <CountryEntry name={countryEntry.name.official} />
          </Col>
        ))
        }
      </Row>
    </div>
  )
}
