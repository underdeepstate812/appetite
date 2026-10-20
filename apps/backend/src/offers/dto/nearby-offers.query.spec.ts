import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { MAX_NEARBY_RADIUS_KM, NearbyOffersQueryDto } from "./nearby-offers.query";

async function errorsFor(radiusKm: string) {
  const dto = plainToInstance(NearbyOffersQueryDto, { lat: "59.93", lng: "30.36", radiusKm });
  return (await validate(dto)).filter((e) => e.property === "radiusKm");
}

describe("NearbyOffersQueryDto.radiusKm", () => {
  it.each(["0.5", "10", String(MAX_NEARBY_RADIUS_KM)])("принимает %s км", async (radius) => {
    expect(await errorsFor(radius)).toHaveLength(0);
  });

  it.each([String(MAX_NEARBY_RADIUS_KM + 0.1), "101", "99999999", "Infinity", "1e9"])(
    "отклоняет %s км (выше верхней границы)",
    async (radius) => {
      const [error] = await errorsFor(radius);
      expect(error.constraints).toHaveProperty("max");
    }
  );

  it.each(["0", "-5", "abc", ""])("отклоняет %p", async (radius) => {
    expect(await errorsFor(radius)).not.toHaveLength(0);
  });
});
