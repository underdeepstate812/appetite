import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBusinessApplicationDto } from "./dto/create-business-application.dto";

@Injectable()
export class BusinessApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBusinessApplicationDto) {
    return this.prisma.businessApplication.create({ data: dto });
  }
}
