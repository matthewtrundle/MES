-- P5: Expand Role enum from 3 to 8 roles

ALTER TYPE "Role" ADD VALUE 'buyer';
ALTER TYPE "Role" ADD VALUE 'receiving_mgr';
ALTER TYPE "Role" ADD VALUE 'qa_inspector';
ALTER TYPE "Role" ADD VALUE 'supply_chain_mgr';
ALTER TYPE "Role" ADD VALUE 'shipping_coordinator';
