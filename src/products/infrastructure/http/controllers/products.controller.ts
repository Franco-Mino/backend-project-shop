import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { GetUser } from '../../../../auth/infrastructure/http/decorators/get-user.decorator';
import { Role } from '../../../../auth/domain/enums/role.enum';
import { User } from '../../../../auth/domain/entities/user.entity';

import { CreateProductCommand } from '../../../application/commands/create-product/create-product.command';
import { UpdateProductCommand } from '../../../application/commands/update-product/update-product.command';
import { DeleteProductCommand } from '../../../application/commands/delete-product/delete-product.command';
import { FindProductQuery } from '../../../application/queries/find-product/find-product.query';
import { ListProductsQuery } from '../../../application/queries/list-products/list-products.query';

import { CreateProductRequestDto } from '../dto/create-product.request.dto';
import { UpdateProductRequestDto } from '../dto/update-product.request.dto';
import { ProductResponseDto } from '../dto/product.response.dto';
import { ProductHttpMapper } from '../mappers/product.http-mapper';
import { FilesValidationPipe } from '../../../../common/pipes/files-validation.pipe';
import { PaginationDto } from '../../../../common/pagination/dto/pagination.dto';
import { Product } from '../../../domain/entities/product.entity';

/**
 * HTTP ADAPTER (Primary Adapter) — ProductsController
 *
 * El controller es lo más delgado posible: recibe HTTP, construye el
 * Command/Query correspondiente, lo despacha al bus, y mapea la
 * respuesta del dominio a un DTO HTTP.
 *
 * No tiene lógica de negocio. Nunca importa nada de TypeORM ni S3.
 * Si mañana agregan GraphQL, solo crean un nuevo controller/resolver
 * que use los mismos Commands y Queries.
 */
const imageInterceptor = FilesInterceptor('images', 5, {
  storage: memoryStorage(),
});

@Controller('products')
export class ProductsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── ADMIN ONLY ──────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(imageInterceptor)
  async create(
    @GetUser() user: User,
    @Body() dto: CreateProductRequestDto,
    @UploadedFiles(new FilesValidationPipe()) files: Express.Multer.File[],
  ): Promise<ProductResponseDto> {
    const product = await this.commandBus.execute<
      CreateProductCommand,
      Product
    >(new CreateProductCommand({ ...dto, files, createdById: user.id }));
    return ProductHttpMapper.toResponse(product);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(imageInterceptor)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductRequestDto,
    @UploadedFiles(new FilesValidationPipe()) files: Express.Multer.File[],
  ): Promise<ProductResponseDto> {
    const product = await this.commandBus.execute<
      UpdateProductCommand,
      Product
    >(new UpdateProductCommand({ id, ...dto, files }));
    return ProductHttpMapper.toResponse(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.commandBus.execute(new DeleteProductCommand(id));
  }

  // ─── PUBLIC ──────────────────────────────────────────────────────────────────

  @Get()
  async findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<ProductResponseDto[]> {
    const products = await this.queryBus.execute<ListProductsQuery, Product[]>(
      new ListProductsQuery(paginationDto.limit, paginationDto.offset),
    );
    return ProductHttpMapper.toResponseMany(products);
  }

  @Get(':term')
  async findOne(@Param('term') term: string): Promise<ProductResponseDto> {
    const product = await this.queryBus.execute<FindProductQuery, Product>(
      new FindProductQuery(term),
    );
    return ProductHttpMapper.toResponse(product);
  }
}
